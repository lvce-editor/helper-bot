import extract from 'extract-zip'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

export interface ArtifactManifest {
  readonly baseBranch?: string
  readonly branchName?: string
  readonly commitMessage?: string
  readonly deletedFiles?: readonly string[]
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly migrationId: string
  readonly pullRequestTitle?: string
  readonly repoCommands?: readonly {
    readonly branch: string
    readonly type: 'modernize-branch-protection'
  }[]
  readonly requestId: string
  readonly status: 'error' | 'success'
  readonly targetRepository: string
}

export interface ChangedFile {
  readonly content: string
  readonly path: string
  readonly type?: 'created' | 'updated' | 'deleted'
}

export interface DownloadMigrationArtifactResult {
  readonly changedFiles: readonly ChangedFile[]
  readonly manifest: ArtifactManifest
}

export interface DownloadMigrationArtifactOptions {
  readonly octokit: any
  readonly owner: string
  readonly repo: string
  readonly runId: number
}

interface ArtifactCandidate {
  readonly created_at?: string
  readonly expired?: boolean
  readonly id: number
  readonly name: string
  readonly updated_at?: string
}

const getArtifactArchiveBuffer = async (data: unknown): Promise<Buffer> => {
  if (Buffer.isBuffer(data)) {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data)
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  if (typeof data === 'string') {
    return Buffer.from(data, 'binary')
  }
  if (data && typeof data === 'object' && 'arrayBuffer' in data && typeof data.arrayBuffer === 'function') {
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  throw new Error('Unsupported artifact archive payload')
}

const getArtifactTimestamp = (artifact: Readonly<ArtifactCandidate>): number => {
  const timestamp = artifact.updated_at || artifact.created_at || ''
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

const compareArtifactsNewestFirst = (a: Readonly<ArtifactCandidate>, b: Readonly<ArtifactCandidate>): number => {
  return getArtifactTimestamp(b) - getArtifactTimestamp(a) || b.id - a.id
}

const extractArtifactArchive = async (archivePath: string, outputDir: string): Promise<void> => {
  await extract(archivePath, { dir: outputDir })
}

const resolveArtifactPath = (root: string, relativePath: string): string => {
  const resolved = resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`Invalid artifact path: ${relativePath}`)
  }
  return resolved
}

const listArtifactFiles = async (filesRoot: string, relativeDir = ''): Promise<readonly string[]> => {
  const directoryPath = relativeDir ? resolveArtifactPath(filesRoot, relativeDir) : filesRoot
  let entries
  try {
    entries = await readdir(directoryPath, { withFileTypes: true })
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
  const paths: string[] = []
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name
    if (entry.isDirectory()) {
      paths.push(...(await listArtifactFiles(filesRoot, relativePath)))
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    paths.push(relativePath.split(sep).join('/'))
  }
  return paths
}

export const getChangedFiles = async (artifactRoot: string, manifest: ArtifactManifest): Promise<readonly ChangedFile[]> => {
  const filesRoot = join(artifactRoot, 'files')
  const filePaths = await listArtifactFiles(filesRoot)
  const changedFiles: ChangedFile[] = []
  for (const relativePath of filePaths) {
    const filePath = resolveArtifactPath(filesRoot, relativePath)
    const content = await readFile(filePath, 'utf8')
    changedFiles.push({
      content,
      path: relativePath,
    })
  }
  for (const deletedFile of manifest.deletedFiles || []) {
    changedFiles.push({
      content: '',
      path: deletedFile,
      type: 'deleted',
    })
  }
  return changedFiles
}

export const downloadMigrationArtifact = async (options: Readonly<DownloadMigrationArtifactOptions>): Promise<DownloadMigrationArtifactResult | undefined> => {
  const artifacts = await options.octokit.rest.actions.listWorkflowRunArtifacts({
    owner: options.owner,
    repo: options.repo,
    run_id: options.runId,
  })
  const artifact = artifacts.data.artifacts
    .filter((candidate: ArtifactCandidate) => !candidate.expired && String(candidate.name).startsWith('migration-result-'))
    .sort(compareArtifactsNewestFirst)[0]
  if (!artifact) {
    return undefined
  }
  const archiveResponse = await options.octokit.rest.actions.downloadArtifact({
    archive_format: 'zip',
    artifact_id: artifact.id,
    owner: options.owner,
    repo: options.repo,
  })
  const archiveBuffer = await getArtifactArchiveBuffer(archiveResponse.data)
  const tempDir = await mkdtemp(join(tmpdir(), `migration-artifact-run-${options.runId}-`))
  const archiveDir = join(tempDir, `download-${artifact.id}`)
  const extractDir = join(tempDir, `extract-${artifact.id}`)
  const archivePath = join(archiveDir, 'artifact.zip')
  try {
    await mkdir(archiveDir, { recursive: true })
    await mkdir(extractDir, { recursive: true })
    await writeFile(archivePath, archiveBuffer)
    await extractArtifactArchive(archivePath, extractDir)
    const manifestPath = join(extractDir, 'manifest.json')
    const manifestContent = await readFile(manifestPath, 'utf8')
    const manifest: ArtifactManifest = JSON.parse(manifestContent)
    const changedFiles = await getChangedFiles(extractDir, manifest)
    return {
      changedFiles,
      manifest,
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
}
