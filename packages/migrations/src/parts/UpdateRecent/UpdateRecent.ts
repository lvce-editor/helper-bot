import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import type { MigrationResult } from '../Types/Types.ts'

export interface UpdateRecentOptions {
  readonly githubToken?: string
  readonly lookbackHours?: number
  readonly now?: string
  readonly OctokitConstructor?: typeof OctokitConstructor
  readonly owner?: string
}

export interface UpdateRecentResult {
  readonly generatedAt: string
  readonly lookbackHours: number
  readonly owner: string
  readonly repositories: readonly string[]
  readonly schemaVersion: 1
  readonly summary: {
    readonly recent: number
    readonly scanned: number
    readonly skipped: number
  }
}

interface Repository {
  readonly archived?: boolean
  readonly default_branch?: string
  readonly disabled?: boolean
  readonly fork?: boolean
  readonly name: string
}

const DEFAULT_OWNER = 'lvce-editor'
const DEFAULT_LOOKBACK_HOURS = 48

const createOctokit = (options: Readonly<UpdateRecentOptions>): Octokit => {
  const OctokitCtor = options.OctokitConstructor || OctokitConstructor
  return new OctokitCtor({
    ...(options.githubToken && { auth: options.githubToken }),
  })
}

const listPublicRepositories = async (octokit: Readonly<Octokit>, owner: string): Promise<readonly Repository[]> => {
  const repos: Repository[] = []
  for (let page = 1; ; page++) {
    const response = await octokit.request('GET /orgs/{org}/repos', {
      org: owner,
      page,
      per_page: 100,
      type: 'public',
    })
    const data = Array.isArray(response.data) ? (response.data as Repository[]) : []
    repos.push(...data)
    if (data.length < 100) {
      break
    }
  }
  return repos
}

const isSkippedRepository = (repo: Readonly<Repository>): boolean => {
  return Boolean(repo.archived || repo.disabled || repo.fork)
}

const hasRecentDefaultBranchCommit = async (octokit: Readonly<Octokit>, owner: string, repo: Readonly<Repository>, since: string): Promise<boolean> => {
  const response = await octokit.request('GET /repos/{owner}/{repo}/commits', {
    owner,
    per_page: 1,
    repo: repo.name,
    sha: repo.default_branch || 'main',
    since,
  })
  return Array.isArray(response.data) && response.data.length > 0
}

export const updateRecent = async (options: Readonly<UpdateRecentOptions> = {}): Promise<UpdateRecentResult> => {
  const owner = options.owner || DEFAULT_OWNER
  const lookbackHours = options.lookbackHours || DEFAULT_LOOKBACK_HOURS
  const generatedAt = options.now || new Date().toISOString()
  const since = new Date(Date.parse(generatedAt) - lookbackHours * 60 * 60 * 1000).toISOString()
  const octokit = createOctokit(options)
  const publicRepos = await listPublicRepositories(octokit, owner)
  const repositories: string[] = []
  let skipped = 0

  for (const repo of publicRepos) {
    if (isSkippedRepository(repo)) {
      skipped++
      continue
    }
    if (await hasRecentDefaultBranchCommit(octokit, owner, repo, since)) {
      repositories.push(`${owner}/${repo.name}`)
    }
  }

  return {
    generatedAt,
    lookbackHours,
    owner,
    repositories,
    schemaVersion: 1,
    summary: {
      recent: repositories.length,
      scanned: publicRepos.length,
      skipped,
    },
  }
}

export const updateRecentMigration = async (options: Readonly<UpdateRecentOptions> = {}): Promise<MigrationResult> => {
  const updateRecentResult = await updateRecent(options)
  return {
    changedFiles: [],
    data: {
      updateRecent: updateRecentResult,
    },
    pullRequestTitle: 'update-recent',
    status: 'success',
    statusCode: 200,
  }
}
