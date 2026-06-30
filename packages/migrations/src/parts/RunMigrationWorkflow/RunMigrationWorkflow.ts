import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, sep } from 'node:path'
import type { ChangedFile, MigrationResult, RepoCommand } from '../Types/Types.ts'
import { commandMap } from '../CommandMap/CommandMap.ts'
import { assertAllowedTargetRepository } from '../MigrationSecurity/MigrationSecurity.ts'

export interface ArtifactManifest {
  readonly baseBranch?: string
  readonly branchName?: string
  readonly commitMessage?: string
  readonly data?: any
  readonly deletedFiles?: readonly string[]
  readonly dryRun?: boolean
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly migrationId: string
  readonly pullRequestTitle?: string
  readonly repoCommands?: readonly RepoCommand[]
  readonly repositoriesNotToUpgrade?: readonly string[]
  readonly repositoriesToUpgrade?: readonly string[]
  readonly requestId: string
  readonly status: 'error' | 'success'
  readonly targetRepository: string
}

export interface RunMigrationWorkflowOptions {
  readonly baseBranch?: string
  readonly dryRun?: boolean
  readonly githubToken?: string
  readonly invokeMigration?: (migrationId: string, options: Record<string, any>) => Promise<MigrationResult>
  readonly migrationId: string
  readonly migrationOptionsJson?: string
  readonly outputDir: string
  readonly requestId: string
  readonly targetRepository: string
}

const ensureRelativePath = (path: string): string => {
  const normalizedPath = normalize(path)
  if (normalizedPath.startsWith('..') || normalizedPath.includes(`${sep}..${sep}`) || normalizedPath.startsWith(sep)) {
    throw new Error(`Invalid changed file path: ${path}`)
  }
  return normalizedPath
}

const writeChangedFile = async (outputDir: string, changedFile: Readonly<ChangedFile>): Promise<void> => {
  if (changedFile.type === 'deleted') {
    return
  }
  const relativePath = ensureRelativePath(changedFile.path)
  const targetPath = join(outputDir, 'files', relativePath)
  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, changedFile.content)
}

const writeManifest = async (outputDir: string, manifest: Readonly<ArtifactManifest>): Promise<void> => {
  await mkdir(outputDir, { recursive: true })
  const manifestPath = join(outputDir, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

const getInvocationOptions = (targetRepository: string, migrationOptionsJson: string | undefined, githubToken: string | undefined): Record<string, any> => {
  const { owner: repositoryOwner, repo: repositoryName } = assertAllowedTargetRepository(targetRepository)
  const parsedOptions = migrationOptionsJson ? JSON.parse(migrationOptionsJson) : {}
  return {
    ...parsedOptions,
    ...(githubToken && { githubToken }),
    repositoryName,
    repositoryOwner,
  }
}

const invokeMigrationCommand = async (migrationId: string, options: Record<string, any>): Promise<MigrationResult> => {
  const command = (commandMap as Record<string, (options: Record<string, any>) => Promise<unknown>>)[migrationId]
  if (!command) {
    throw new Error(`Unknown migration command: ${migrationId}`)
  }
  const result = await command(options)
  if (!result || typeof result !== 'object' || !('status' in result) || !('changedFiles' in result)) {
    throw new Error(`Command is not a migration command: ${migrationId}`)
  }
  return result as MigrationResult
}

const getReleasePlanRepositoryGroups = (data: any): Pick<ArtifactManifest, 'repositoriesNotToUpgrade' | 'repositoriesToUpgrade'> => {
  const entries = data?.releasePlan?.entries
  if (!Array.isArray(entries)) {
    return {}
  }
  return {
    repositoriesNotToUpgrade: entries.filter((entry: any) => entry.upgrade !== true).map((entry: any) => entry.repository),
    repositoriesToUpgrade: entries.filter((entry: any) => entry.upgrade === true).map((entry: any) => entry.repository),
  }
}

const toManifest = (options: Readonly<RunMigrationWorkflowOptions>, result: Readonly<MigrationResult>): ArtifactManifest => {
  const deletedFiles = result.changedFiles.filter((changedFile) => changedFile.type === 'deleted').map((changedFile) => changedFile.path)
  const data = 'data' in result && result.data ? result.data : undefined
  const releasePlanRepositoryGroups = getReleasePlanRepositoryGroups(data)
  return {
    ...('repositoriesToUpgrade' in releasePlanRepositoryGroups && { repositoriesToUpgrade: releasePlanRepositoryGroups.repositoriesToUpgrade }),
    ...(options.baseBranch && { baseBranch: options.baseBranch }),
    ...('branchName' in result && result.branchName && { branchName: result.branchName }),
    ...('commitMessage' in result && result.commitMessage && { commitMessage: result.commitMessage }),
    ...(data && { data }),
    ...(deletedFiles.length > 0 && { deletedFiles }),
    ...(options.dryRun && { dryRun: true }),
    ...('errorCode' in result && result.errorCode && { errorCode: result.errorCode }),
    ...('errorMessage' in result && result.errorMessage && { errorMessage: result.errorMessage }),
    migrationId: options.migrationId,
    ...('pullRequestTitle' in result && result.pullRequestTitle && { pullRequestTitle: result.pullRequestTitle }),
    ...('repoCommands' in result && result.repoCommands && { repoCommands: result.repoCommands }),
    requestId: options.requestId,
    status: result.status,
    targetRepository: options.targetRepository,
    ...('repositoriesNotToUpgrade' in releasePlanRepositoryGroups && { repositoriesNotToUpgrade: releasePlanRepositoryGroups.repositoriesNotToUpgrade }),
  }
}

export const runMigrationWorkflow = async (options: Readonly<RunMigrationWorkflowOptions>): Promise<MigrationResult> => {
  const invokeMigration = options.invokeMigration || invokeMigrationCommand
  try {
    const invocationOptions = getInvocationOptions(options.targetRepository, options.migrationOptionsJson, options.githubToken)
    const result = await invokeMigration(options.migrationId, invocationOptions)
    for (const changedFile of result.changedFiles) {
      await writeChangedFile(options.outputDir, changedFile)
    }
    await writeManifest(options.outputDir, toManifest(options, result))
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorResult: MigrationResult = {
      changedFiles: [],
      errorMessage,
      status: 'error',
      statusCode: 500,
    }
    await writeManifest(options.outputDir, toManifest(options, errorResult))
    return errorResult
  }
}
