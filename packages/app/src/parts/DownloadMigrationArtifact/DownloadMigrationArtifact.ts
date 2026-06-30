import extract from 'extract-zip'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

export interface ArtifactManifest {
  readonly artifactKind?: 'migration-result' | 'org-release-plan'
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
  readonly targetRepository?: string
}

export interface ReleasePlanEntry {
  readonly commitCountSinceLatestTag?: number
  readonly defaultBranch?: string
  readonly defaultBranchSha?: string
  readonly latestTag?: string
  readonly latestTagSha?: string
  readonly newTag?: string
  readonly nonUpgradeReason?: string
  readonly recentCommitCount?: number
  readonly repository: string
  readonly targetSha?: string
  readonly upgrade: boolean
}

export interface ReleasePlan {
  readonly entries: readonly ReleasePlanEntry[]
  readonly generatedAt: string
  readonly lookbackHours: number
  readonly owner: string
  readonly schemaVersion: 1
  readonly summary: {
    readonly scanned: number
    readonly skipped: number
    readonly upgrade: number
  }
}

export interface ChangedFile {
  readonly content: string
  readonly path: string
  readonly type?: 'created' | 'updated' | 'deleted'
}

export interface DownloadMigrationArtifactResult {
  readonly changedFiles: readonly ChangedFile[]
  readonly manifest: ArtifactManifest
  readonly releasePlan?: ReleasePlan
}

export interface DownloadMigrationArtifactOptions {
  readonly logger?: Logger
  readonly octokit: any
  readonly owner: string
  readonly repo: string
  readonly runId: number
}

interface Logger {
  readonly info: (...args: readonly unknown[]) => void
}

interface ArtifactCandidate {
  readonly created_at?: string
  readonly expired?: boolean
  readonly id: number
  readonly name: string
  readonly updated_at?: string
}

const ARTIFACT_API_TIMEOUT = 20_000

const withTimeout = async <T>(promise: Promise<T>, timeout: number, message: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message))
        }, timeout)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
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
  const logger = options.logger
  logger?.info(`[DownloadMigrationArtifact] listing artifacts for run ${options.runId}`)
  const artifacts: any = await withTimeout(
    options.octokit.rest.actions.listWorkflowRunArtifacts({
      owner: options.owner,
      repo: options.repo,
      request: {
        timeout: ARTIFACT_API_TIMEOUT,
      },
      run_id: options.runId,
    }),
    ARTIFACT_API_TIMEOUT + 1_000,
    `Timed out listing artifacts for workflow run ${options.runId}`,
  )
  logger?.info(`[DownloadMigrationArtifact] got ${artifacts.data.artifacts.length} artifacts for run ${options.runId}`)
  const artifact = artifacts.data.artifacts
    .filter((candidate: ArtifactCandidate) => !candidate.expired && String(candidate.name).startsWith('migration-result-'))
    .sort(compareArtifactsNewestFirst)[0]
  if (!artifact) {
    return undefined
  }
  logger?.info(`[DownloadMigrationArtifact] downloading artifact ${artifact.id} (${artifact.name}) for run ${options.runId}`)
  const archiveResponse: any = await withTimeout(
    options.octokit.rest.actions.downloadArtifact({
      archive_format: 'zip',
      artifact_id: artifact.id,
      owner: options.owner,
      repo: options.repo,
      request: {
        timeout: ARTIFACT_API_TIMEOUT,
      },
    }),
    ARTIFACT_API_TIMEOUT + 1_000,
    `Timed out downloading artifact ${artifact.id} for workflow run ${options.runId}`,
  )
  logger?.info(`[DownloadMigrationArtifact] downloaded artifact ${artifact.id} zip response for run ${options.runId}`)
  const archiveBuffer = await getArtifactArchiveBuffer(archiveResponse.data)
  logger?.info(`[DownloadMigrationArtifact] got archive buffer for artifact ${artifact.id}: ${archiveBuffer.byteLength} bytes`)
  const tempDir = await mkdtemp(join(tmpdir(), `migration-artifact-run-${options.runId}-`))
  const archiveDir = join(tempDir, `download-${artifact.id}`)
  const extractDir = join(tempDir, `extract-${artifact.id}`)
  const archivePath = join(archiveDir, 'artifact.zip')
  try {
    await mkdir(archiveDir, { recursive: true })
    await mkdir(extractDir, { recursive: true })
    await writeFile(archivePath, archiveBuffer)
    logger?.info(`[DownloadMigrationArtifact] extracting artifact ${artifact.id} to ${extractDir}`)
    await extractArtifactArchive(archivePath, extractDir)
    logger?.info(`[DownloadMigrationArtifact] extracted artifact ${artifact.id}`)
    const manifestPath = join(extractDir, 'manifest.json')
    const manifestContent = await readFile(manifestPath, 'utf8')
    const manifest: ArtifactManifest = JSON.parse(manifestContent)
    logger?.info(`[DownloadMigrationArtifact] read manifest for ${manifest.targetRepository || manifest.artifactKind || 'unknown'} ${manifest.migrationId}`)
    const changedFiles = await getChangedFiles(extractDir, manifest)
    let releasePlan: ReleasePlan | undefined
    try {
      const releasePlanContent = await readFile(join(extractDir, 'release-plan.json'), 'utf8')
      releasePlan = JSON.parse(releasePlanContent)
      logger?.info(`[DownloadMigrationArtifact] read release plan with ${releasePlan.entries.length} entries from artifact ${artifact.id}`)
    } catch (error: any) {
      if (!error || error.code !== 'ENOENT') {
        throw error
      }
    }
    logger?.info(`[DownloadMigrationArtifact] read ${changedFiles.length} changed files from artifact ${artifact.id}`)
    return {
      changedFiles,
      manifest,
      ...(releasePlan && { releasePlan }),
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
}
