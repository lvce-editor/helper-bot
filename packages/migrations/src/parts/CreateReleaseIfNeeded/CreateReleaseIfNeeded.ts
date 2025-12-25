import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { githubFetch } from '../GithubFetch/GithubFetch.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const getLatestRelease = async (
  fetchFn: typeof globalThis.fetch,
  githubToken: string,
  owner: string,
  repo: string,
): Promise<{ tag_name: string; target_commitish: string } | null> => {
  try {
    const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, githubToken, fetchFn)

    if (response.status === 404) {
      // No releases found, try to get latest tag instead
      const tagsResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=1`, githubToken, fetchFn)

      if (tagsResponse.status !== 200 || !Array.isArray(tagsResponse.data) || tagsResponse.data.length === 0) {
        return null
      }

      const latestTag = tagsResponse.data[0]
      // Get the commit SHA for the tag
      const tagRefResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/tags/${latestTag.name}`, githubToken, fetchFn)

      if (tagRefResponse.status !== 200) {
        return null
      }

      return {
        tag_name: latestTag.name,
        target_commitish: tagRefResponse.data.object.sha,
      }
    }

    if (response.status !== 200) {
      return null
    }

    return {
      tag_name: response.data.tag_name,
      target_commitish: response.data.target_commitish,
    }
  } catch (error) {
    return null
  }
}

const getLatestCommitOnBranch = async (fetchFn: typeof globalThis.fetch, githubToken: string, owner: string, repo: string, branch: string): Promise<string> => {
  const branchRefResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, githubToken, fetchFn)

  if (branchRefResponse.status !== 200) {
    throw new Error(`Failed to get branch ref: ${branchRefResponse.status}`)
  }

  return branchRefResponse.data.object.sha
}

const compareCommits = async (
  fetchFn: typeof globalThis.fetch,
  githubToken: string,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<{ hasCommits: boolean; commitCount: number }> => {
  try {
    const comparison = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`, githubToken, fetchFn)

    if (comparison.status !== 200) {
      // If comparison fails, assume there are commits
      return {
        hasCommits: true,
        commitCount: 0,
      }
    }

    // If status is 'identical', there are no commits
    // If status is 'ahead' or 'diverged', there are commits
    const hasCommits = comparison.data.status !== 'identical' && comparison.data.ahead_by > 0
    return {
      hasCommits,
      commitCount: comparison.data.ahead_by || 0,
    }
  } catch (error: any) {
    // If comparison fails (e.g., base doesn't exist), assume there are commits
    return {
      hasCommits: true,
      commitCount: 0,
    }
  }
}

const incrementMinorVersion = (tagName: string): string => {
  // Remove 'v' prefix if present
  const hasVPrefix = tagName.startsWith('v')
  const versionWithoutPrefix = hasVPrefix ? tagName.slice(1) : tagName

  // Parse version (format: major.minor.patch)
  const parts = versionWithoutPrefix.split('.')
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${tagName}. Expected format: major.minor.patch`)
  }

  const major = parseInt(parts[0], 10)
  const minor = parseInt(parts[1], 10)
  const patch = parseInt(parts[2], 10)

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error(`Invalid version format: ${tagName}. All parts must be numbers`)
  }

  // Increment minor version and reset patch to 0
  const newMinor = minor + 1
  const newVersion = `${major}.${newMinor}.0`

  // Restore 'v' prefix if it was present
  return hasVPrefix ? `v${newVersion}` : newVersion
}

export interface CreateReleaseIfNeededOptions extends BaseMigrationOptions {
  readonly githubToken: string
  readonly baseBranch?: string
}

export const createReleaseIfNeeded = async (options: Readonly<CreateReleaseIfNeededOptions>): Promise<MigrationResult> => {
  try {
    const { fetch, githubToken, repositoryName: repo, repositoryOwner: owner } = options
    const baseBranch = options.baseBranch || 'main'

    // Get the latest release or tag
    const latestRelease = await getLatestRelease(fetch, githubToken, owner, repo)

    if (!latestRelease) {
      return {
        branchName: undefined,
        changedFiles: [],
        commitMessage: undefined,
        data: {
          message: 'No releases or tags found. Skipping release creation.',
        },
        pullRequestTitle: 'create-release-if-needed',
        status: 'success',
        statusCode: 200,
      }
    }

    const latestTagName = latestRelease.tag_name
    const latestTagCommitSha = latestRelease.target_commitish

    // Get the latest commit on main branch
    const latestMainCommitSha = await getLatestCommitOnBranch(fetch, githubToken, owner, repo, baseBranch)

    // Compare commits between the tag and main branch
    const { hasCommits, commitCount } = await compareCommits(fetch, githubToken, owner, repo, latestTagCommitSha, latestMainCommitSha)

    if (!hasCommits) {
      return {
        branchName: undefined,
        changedFiles: [],
        commitMessage: undefined,
        data: {
          message: `No new commits since ${latestTagName}. No release needed.`,
        },
        pullRequestTitle: 'create-release-if-needed',
        status: 'success',
        statusCode: 200,
      }
    }

    // Increment minor version
    const newVersion = incrementMinorVersion(latestTagName)

    // Create the new release
    const createReleaseResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/releases`, githubToken, fetch, {
      method: 'POST',
      body: JSON.stringify({
        tag_name: newVersion,
        target_commitish: baseBranch,
        name: newVersion,
        body: `Release ${newVersion} with ${commitCount} new commit${commitCount !== 1 ? 's' : ''} since ${latestTagName}`,
        draft: false,
        prerelease: false,
      }),
    })

    if (createReleaseResponse.status !== 201) {
      throw new Error(`Failed to create release: ${createReleaseResponse.status} - ${JSON.stringify(createReleaseResponse.data)}`)
    }

    return {
      branchName: undefined,
      changedFiles: [],
      commitMessage: undefined,
      data: {
        message: `Created new release ${newVersion} with ${commitCount} new commit${commitCount !== 1 ? 's' : ''} since ${latestTagName}`,
        releaseTag: newVersion,
      },
      pullRequestTitle: 'create-release-if-needed',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.CREATE_RELEASE_IF_NEEDED_FAILED,
      errorMessage: stringifyError(error),
      status: 'error' as const,
    }
    return {
      changedFiles: [],
      errorCode: errorResult.errorCode,
      errorMessage: errorResult.errorMessage,
      status: 'error',
      statusCode: getHttpStatusCode(errorResult),
    }
  }
}
