import type { Octokit } from '@octokit/rest'
import type * as FsPromises from 'node:fs/promises'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import type { MigrationResult, ExecFunction } from '../Types/Types.ts'
import { cloneRepositoryTmp, type CloneRepositoryTmpOptions, type CloneRepositoryTmpResult } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import {
  eslintConfigPackageName,
  eslintPackageName,
  getEslintDependencyVersions,
  hasEslintDependencies,
  needsEslintDependencyUpdate,
  type EslintDependencyVersions,
  type LatestEslintDependencyVersions,
} from '../EslintDependencies/EslintDependencies.ts'
import { getLatestNpmVersion } from '../GetLatestNpmVersion/GetLatestNpmVersion.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

interface Repository {
  readonly archived?: boolean
  readonly disabled?: boolean
  readonly fork?: boolean
  readonly name: string
}

export interface EslintUpdatePlanEntry {
  readonly currentVersions?: EslintDependencyVersions
  readonly nonUpgradeReason?: string
  readonly repository: string
  readonly upgrade: boolean
}

export interface EslintUpdatePlan {
  readonly entries: readonly EslintUpdatePlanEntry[]
  readonly generatedAt: string
  readonly latestVersions: LatestEslintDependencyVersions
  readonly owner: string
  readonly schemaVersion: 1
  readonly summary: {
    readonly scanned: number
    readonly skipped: number
    readonly upgrade: number
  }
}

type FileSystem = Readonly<typeof FsPromises> & {
  exists: (path: string | Readonly<Buffer> | Readonly<URL>) => Promise<boolean>
}

type CloneRepository = (
  exec: ExecFunction,
  owner: string,
  repo: string,
  githubToken?: string,
  options?: Readonly<CloneRepositoryTmpOptions>,
) => Promise<CloneRepositoryTmpResult>

export interface PlanOrgEslintUpdatesOptions {
  readonly cloneRepository?: CloneRepository
  readonly excludedRepos?: readonly string[]
  readonly exec: ExecFunction
  readonly fetch: typeof globalThis.fetch
  readonly fs: FileSystem
  readonly githubToken?: string
  readonly now?: string
  readonly OctokitConstructor?: typeof OctokitConstructor
  readonly owner?: string
}

const DEFAULT_OWNER = 'lvce-editor'

const createOctokit = (options: Readonly<PlanOrgEslintUpdatesOptions>): Octokit => {
  const OctokitCtor = options.OctokitConstructor || OctokitConstructor
  return new OctokitCtor({
    ...(options.githubToken && { auth: options.githubToken }),
  })
}

const listPublicRepositories = async (octokit: Readonly<Octokit>, owner: string): Promise<readonly Repository[]> => {
  const repositories: Repository[] = []
  for (let page = 1; ; page++) {
    const response = await octokit.request('GET /orgs/{org}/repos', {
      org: owner,
      page,
      per_page: 100,
      type: 'public',
    })
    const data = Array.isArray(response.data) ? (response.data as Repository[]) : []
    repositories.push(...data)
    if (data.length < 100) {
      return repositories
    }
  }
}

const createSkippedEntry = (repository: string, nonUpgradeReason: string): EslintUpdatePlanEntry => {
  return {
    nonUpgradeReason,
    repository,
    upgrade: false,
  }
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

const inspectRepository = async (
  options: Readonly<PlanOrgEslintUpdatesOptions>,
  owner: string,
  repository: Readonly<Repository>,
  latestVersions: Readonly<LatestEslintDependencyVersions>,
): Promise<EslintUpdatePlanEntry> => {
  const repositoryId = `${owner}/${repository.name}`
  if (repository.archived) {
    return createSkippedEntry(repositoryId, 'repository archived')
  }
  if (repository.disabled) {
    return createSkippedEntry(repositoryId, 'repository disabled')
  }
  if (repository.fork) {
    return createSkippedEntry(repositoryId, 'fork repository')
  }

  const cloneRepository = options.cloneRepository || cloneRepositoryTmp
  let clonedRepository: CloneRepositoryTmpResult | undefined
  try {
    clonedRepository = await cloneRepository(options.exec, owner, repository.name, options.githubToken, { depth: 1 })
    const packageJsonUri = resolveUri('package.json', clonedRepository.uri)
    if (!(await options.fs.exists(packageJsonUri))) {
      return createSkippedEntry(repositoryId, 'package.json not found')
    }
    const packageJson = JSON.parse(await options.fs.readFile(packageJsonUri, 'utf8'))
    const currentVersions = getEslintDependencyVersions(packageJson)
    if (!hasEslintDependencies(currentVersions)) {
      return createSkippedEntry(repositoryId, 'eslint dependencies not found')
    }
    const upgrade = needsEslintDependencyUpdate(currentVersions, latestVersions)
    return {
      currentVersions,
      ...(!upgrade && { nonUpgradeReason: 'eslint dependencies already up to date' }),
      repository: repositoryId,
      upgrade,
    }
  } catch (error) {
    return createSkippedEntry(repositoryId, `repository inspection failed: ${getErrorMessage(error)}`)
  } finally {
    await clonedRepository?.[Symbol.asyncDispose]()
  }
}

export const planOrgEslintUpdates = async (options: Readonly<PlanOrgEslintUpdatesOptions>): Promise<EslintUpdatePlan> => {
  const owner = options.owner || DEFAULT_OWNER
  const latestVersions = {
    eslintConfigVersion: await getLatestNpmVersion(eslintConfigPackageName, options.fetch),
    eslintVersion: await getLatestNpmVersion(eslintPackageName, options.fetch),
  }
  const excludedRepos = new Set(options.excludedRepos || [])
  const publicRepositories = await listPublicRepositories(createOctokit(options), owner)
  const repositories = publicRepositories.filter((repository) => !excludedRepos.has(repository.name))
  const entries: EslintUpdatePlanEntry[] = []
  for (const repository of repositories) {
    entries.push(await inspectRepository(options, owner, repository, latestVersions))
  }
  const upgrade = entries.filter((entry) => entry.upgrade).length
  return {
    entries,
    generatedAt: options.now || new Date().toISOString(),
    latestVersions,
    owner,
    schemaVersion: 1,
    summary: {
      scanned: entries.length,
      skipped: entries.length - upgrade,
      upgrade,
    },
  }
}

export const planOrgEslintUpdatesMigration = async (options: Readonly<PlanOrgEslintUpdatesOptions>): Promise<MigrationResult> => {
  return {
    changedFiles: [],
    data: {
      eslintUpdatePlan: await planOrgEslintUpdates(options),
    },
    pullRequestTitle: 'plan-org-eslint-updates',
    status: 'success',
    statusCode: 200,
  }
}
