import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import { readFileSync } from 'node:fs'
import type { MigrationResult } from '../Types/Types.ts'
import { incrementMinorVersion } from '../IncrementMinorVersion/IncrementMinorVersion.ts'

export interface PlanOrgReleaseTagsOptions {
  readonly excludedRepos?: readonly string[]
  readonly githubToken?: string
  readonly lookbackHours?: number
  readonly now?: string
  readonly OctokitConstructor?: typeof OctokitConstructor
  readonly owner?: string
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

interface Repository {
  readonly archived?: boolean
  readonly default_branch?: string
  readonly disabled?: boolean
  readonly fork?: boolean
  readonly name: string
}

interface Tag {
  readonly commit?: {
    readonly sha?: string
  }
  readonly name: string
}

interface SemverTag {
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly sha: string
  readonly tag: string
}

const DEFAULT_OWNER = 'lvce-editor'
const DEFAULT_LOOKBACK_HOURS = 24
const defaultReleaseExcludedRepos: readonly string[] = []
const dependenciesConfigUrl = new URL('../../../../app/dependencies.json', import.meta.url)
const RELEASE_WORKFLOW_PATH = '.github/workflows/release.yml'
const FAILED_RELEASE_CONCLUSIONS = new Set(['action_required', 'cancelled', 'failure', 'startup_failure', 'timed_out'])

const semverTagPattern = /^v?(\d+)\.(\d+)\.(\d+)$/

const createOctokit = (options: Readonly<PlanOrgReleaseTagsOptions>): Octokit => {
  const OctokitCtor = options.OctokitConstructor || OctokitConstructor
  return new OctokitCtor({
    ...(options.githubToken && { auth: options.githubToken }),
  })
}

const getReleaseExcludedRepos = (): readonly string[] => {
  try {
    const content = readFileSync(dependenciesConfigUrl, 'utf8')
    const config = JSON.parse(content)
    return config.releaseExcludedRepos || defaultReleaseExcludedRepos
  } catch {
    return defaultReleaseExcludedRepos
  }
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const isNotFoundError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
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

const getDefaultBranchSha = async (octokit: Readonly<Octokit>, owner: string, repo: string, branch: string): Promise<string> => {
  const response = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
    branch,
    owner,
    repo,
  })
  return response.data.commit.sha
}

const parseSemverTag = (tag: Readonly<Tag>): SemverTag | undefined => {
  const match = semverTagPattern.exec(tag.name)
  const sha = tag.commit?.sha
  if (!match || !sha) {
    return undefined
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    sha,
    tag: tag.name,
  }
}

const compareSemverTagsDescending = (a: Readonly<SemverTag>, b: Readonly<SemverTag>): number => {
  return b.major - a.major || b.minor - a.minor || b.patch - a.patch
}

const getLatestSemverTag = async (octokit: Readonly<Octokit>, owner: string, repo: string): Promise<SemverTag | undefined> => {
  const tags: SemverTag[] = []
  for (let page = 1; ; page++) {
    const response = await octokit.request('GET /repos/{owner}/{repo}/tags', {
      owner,
      page,
      per_page: 100,
      repo,
    })
    const data = Array.isArray(response.data) ? (response.data as Tag[]) : []
    for (const tag of data) {
      const semverTag = parseSemverTag(tag)
      if (semverTag) {
        tags.push(semverTag)
      }
    }
    if (data.length < 100) {
      break
    }
  }
  return tags.toSorted(compareSemverTagsDescending)[0]
}

const getCommitCountSince = async (octokit: Readonly<Octokit>, owner: string, repo: string, branch: string, since: string): Promise<number> => {
  let count = 0
  for (let page = 1; ; page++) {
    const response = await octokit.request('GET /repos/{owner}/{repo}/commits', {
      owner,
      page,
      per_page: 100,
      repo,
      sha: branch,
      since,
    })
    const data = Array.isArray(response.data) ? response.data : []
    count += data.length
    if (data.length < 100) {
      break
    }
  }
  return count
}

const getCommitCountSinceTag = async (
  octokit: Readonly<Octokit>,
  owner: string,
  repo: string,
  latestTagSha: string,
  defaultBranchSha: string,
): Promise<number> => {
  const response = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
    base: latestTagSha,
    head: defaultBranchSha,
    owner,
    repo,
  })
  return response.data.ahead_by || 0
}

const getReleaseWorkflowId = async (octokit: Readonly<Octokit>, owner: string, repo: string): Promise<number | string | undefined> => {
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows', {
      owner,
      per_page: 100,
      repo,
    })
    const workflows = Array.isArray(response.data.workflows) ? response.data.workflows : []
    const workflow = workflows.find((item: any) => item.path === RELEASE_WORKFLOW_PATH || item.name === 'release')
    return workflow?.id
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined
    }
    throw error
  }
}

const getReleaseStatusReason = async (
  octokit: Readonly<Octokit>,
  owner: string,
  repo: string,
  latestTag: string,
  latestTagSha: string,
): Promise<string | undefined> => {
  const workflowId = await getReleaseWorkflowId(octokit, owner, repo)
  if (!workflowId) {
    return 'missing release workflow'
  }
  const response = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
    event: 'push',
    owner,
    per_page: 20,
    repo,
    workflow_id: workflowId,
  })
  const workflowRuns = Array.isArray(response.data.workflow_runs) ? response.data.workflow_runs : []
  const run = workflowRuns.find((item: any) => item.head_sha === latestTagSha || item.head_branch === latestTag)
  if (!run || run.status !== 'completed' || !run.conclusion) {
    return 'release pending'
  }
  if (FAILED_RELEASE_CONCLUSIONS.has(run.conclusion)) {
    return 'release failed'
  }
  return undefined
}

const createSkippedEntry = (owner: string, repo: Readonly<Repository>, reason: string): ReleasePlanEntry => {
  return {
    ...(repo.default_branch && { defaultBranch: repo.default_branch }),
    nonUpgradeReason: reason,
    repository: `${owner}/${repo.name}`,
    upgrade: false,
  }
}

const planRepository = async (octokit: Readonly<Octokit>, owner: string, repo: Readonly<Repository>, since: string): Promise<ReleasePlanEntry> => {
  if (repo.archived) {
    return createSkippedEntry(owner, repo, 'repository archived')
  }
  if (repo.disabled) {
    return createSkippedEntry(owner, repo, 'repository disabled')
  }
  if (repo.fork) {
    return createSkippedEntry(owner, repo, 'fork repository')
  }
  const repository = `${owner}/${repo.name}`
  try {
    const defaultBranch = repo.default_branch || 'main'
    const defaultBranchSha = await getDefaultBranchSha(octokit, owner, repo.name, defaultBranch)
    const latestTag = await getLatestSemverTag(octokit, owner, repo.name)
    if (!latestTag) {
      return {
        defaultBranch,
        defaultBranchSha,
        nonUpgradeReason: 'no semver tags',
        repository,
        upgrade: false,
      }
    }
    const recentCommitCount = await getCommitCountSince(octokit, owner, repo.name, defaultBranch, since)
    if (recentCommitCount === 0) {
      return {
        defaultBranch,
        defaultBranchSha,
        latestTag: latestTag.tag,
        latestTagSha: latestTag.sha,
        nonUpgradeReason: 'no recent commits',
        recentCommitCount,
        repository,
        upgrade: false,
      }
    }
    const commitCountSinceLatestTag = await getCommitCountSinceTag(octokit, owner, repo.name, latestTag.sha, defaultBranchSha)
    if (commitCountSinceLatestTag === 0) {
      return {
        commitCountSinceLatestTag,
        defaultBranch,
        defaultBranchSha,
        latestTag: latestTag.tag,
        latestTagSha: latestTag.sha,
        nonUpgradeReason: 'no commits since latest tag',
        recentCommitCount,
        repository,
        upgrade: false,
      }
    }
    const releaseStatusReason = await getReleaseStatusReason(octokit, owner, repo.name, latestTag.tag, latestTag.sha)
    if (releaseStatusReason) {
      return {
        commitCountSinceLatestTag,
        defaultBranch,
        defaultBranchSha,
        latestTag: latestTag.tag,
        latestTagSha: latestTag.sha,
        nonUpgradeReason: releaseStatusReason,
        recentCommitCount,
        repository,
        upgrade: false,
      }
    }
    return {
      commitCountSinceLatestTag,
      defaultBranch,
      defaultBranchSha,
      latestTag: latestTag.tag,
      latestTagSha: latestTag.sha,
      newTag: incrementMinorVersion(latestTag.tag),
      recentCommitCount,
      repository,
      targetSha: defaultBranchSha,
      upgrade: true,
    }
  } catch (error) {
    return {
      defaultBranch: repo.default_branch || 'main',
      nonUpgradeReason: `github api error: ${getErrorMessage(error)}`,
      repository,
      upgrade: false,
    }
  }
}

export const planOrgReleaseTags = async (options: Readonly<PlanOrgReleaseTagsOptions> = {}): Promise<ReleasePlan> => {
  const owner = options.owner || DEFAULT_OWNER
  const lookbackHours = options.lookbackHours || DEFAULT_LOOKBACK_HOURS
  const generatedAt = options.now || new Date().toISOString()
  const since = new Date(Date.parse(generatedAt) - lookbackHours * 60 * 60 * 1000).toISOString()
  const octokit = createOctokit(options)
  const excludedRepos = new Set(options.excludedRepos || getReleaseExcludedRepos())
  const publicRepos = await listPublicRepositories(octokit, owner)
  const repos = publicRepos.filter((repo) => !excludedRepos.has(repo.name))
  const entries = await Promise.all(repos.map((repo) => planRepository(octokit, owner, repo, since)))
  const upgrade = entries.filter((entry) => entry.upgrade).length
  return {
    entries,
    generatedAt,
    lookbackHours,
    owner,
    schemaVersion: 1,
    summary: {
      scanned: entries.length,
      skipped: entries.length - upgrade,
      upgrade,
    },
  }
}

export const planOrgReleaseTagsMigration = async (options: Readonly<PlanOrgReleaseTagsOptions> = {}): Promise<MigrationResult> => {
  const releasePlan = await planOrgReleaseTags(options)
  return {
    changedFiles: [],
    data: {
      releasePlan,
    },
    pullRequestTitle: 'plan-org-release-tags',
    status: 'success',
    statusCode: 200,
  }
}
