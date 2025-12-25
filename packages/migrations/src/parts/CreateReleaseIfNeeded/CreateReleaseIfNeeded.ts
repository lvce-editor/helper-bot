import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { githubFetch } from '../GithubFetch/GithubFetch.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { getLatestRelease } from '../GetLatestRelease/GetLatestRelease.ts'
import { getLatestCommitOnBranch } from '../GetLatestCommitOnBranch/GetLatestCommitOnBranch.ts'
import { compareCommits } from '../CompareCommits/CompareCommits.ts'
import { incrementMinorVersion } from '../IncrementMinorVersion/IncrementMinorVersion.ts'

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
