import extract from 'extract-zip'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
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
  const dataType = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data
  throw new Error(`Unsupported artifact archive payload (type: ${dataType})`)
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
  const artifact = artifacts.data.artifacts.find((candidate: any) => !candidate.expired && String(candidate.name).startsWith('migration-result'))
  if (!artifact) {
    return undefined
  }
  let archiveBuffer: Buffer
  try {
    const archiveResponse = await options.octokit.rest.actions.downloadArtifact({
      archive_format: 'zip',
      artifact_id: artifact.id,
      owner: options.owner,
      repo: options.repo,
    })
    archiveBuffer = await getArtifactArchiveBuffer(archiveResponse.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to download artifact zip for workflow run ${options.runId} in ${options.owner}/${options.repo} (artifact ${artifact.name} #${artifact.id}): ${message}`,
      { cause: error instanceof Error ? error : undefined },
    )
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'migration-artifact-'))
  const archivePath = join(tempDir, 'artifact.zip')
  const extractDir = join(tempDir, 'artifact')
  try {
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
