import { execa } from 'execa'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

export interface ArtifactChangedFile {
  readonly path: string
  readonly type?: 'created' | 'updated' | 'deleted'
}

export interface ArtifactManifest {
  readonly baseBranch?: string
  readonly branchName?: string
  readonly changedFiles: readonly ArtifactChangedFile[]
  readonly commitMessage?: string
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly migrationId: string
  readonly pullRequestTitle?: string
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
  throw new Error('Unsupported artifact archive payload')
}

const extractWithUnzip = async (archivePath: string, outputDir: string): Promise<void> => {
  await execa('unzip', ['-o', archivePath, '-d', outputDir])
}

const extractWithPython = async (archivePath: string, outputDir: string): Promise<void> => {
  await execa('python3', ['-m', 'zipfile', '-e', archivePath, outputDir])
}

const extractArtifactArchive = async (archivePath: string, outputDir: string): Promise<void> => {
  try {
    await extractWithUnzip(archivePath, outputDir)
    return
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('ENOENT')) {
      throw error
    }
  }
  await extractWithPython(archivePath, outputDir)
}

const resolveArtifactPath = (root: string, relativePath: string): string => {
  const resolved = resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`Invalid artifact path: ${relativePath}`)
  }
  return resolved
}

const getChangedFiles = async (artifactRoot: string, manifest: ArtifactManifest): Promise<readonly ChangedFile[]> => {
  const filesRoot = join(artifactRoot, 'files')
  const changedFiles: ChangedFile[] = []
  for (const file of manifest.changedFiles) {
    if (file.type === 'deleted') {
      changedFiles.push({
        content: '',
        path: file.path,
        type: 'deleted',
      })
      continue
    }
    const filePath = resolveArtifactPath(filesRoot, file.path)
    const content = await readFile(filePath, 'utf8')
    changedFiles.push({
      content,
      path: file.path,
      ...(file.type ? { type: file.type } : {}),
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
  const archiveResponse = await options.octokit.rest.actions.downloadArtifact({
    archive_format: 'zip',
    artifact_id: artifact.id,
    owner: options.owner,
    repo: options.repo,
  })
  const archiveBuffer = await getArtifactArchiveBuffer(archiveResponse.data)
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
