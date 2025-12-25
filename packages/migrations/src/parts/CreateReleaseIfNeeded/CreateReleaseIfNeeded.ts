import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { compareCommits } from '../CompareCommits/CompareCommits.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestCommitOnBranch } from '../GetLatestCommitOnBranch/GetLatestCommitOnBranch.ts'
import { getLatestRelease } from '../GetLatestRelease/GetLatestRelease.ts'
import { incrementMinorVersion } from '../IncrementMinorVersion/IncrementMinorVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export interface CreateReleaseIfNeededOptions extends BaseMigrationOptions {
  readonly baseBranch?: string
  readonly githubToken: string
  readonly OctokitConstructor?: typeof OctokitConstructor
}

export const createReleaseIfNeeded = async (options: Readonly<CreateReleaseIfNeededOptions>): Promise<MigrationResult> => {
  try {
    const { githubToken, OctokitConstructor: OctokitCtor = OctokitConstructor, repositoryName: repo, repositoryOwner: owner } = options
    const baseBranch = options.baseBranch || 'main'

    const octokit: Octokit = new OctokitCtor({
      auth: githubToken,
    })

    // Get the latest release or tag
    const latestRelease = await getLatestRelease(octokit, owner, repo)

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
    const latestMainCommitSha = await getLatestCommitOnBranch(octokit, owner, repo, baseBranch)

    // Compare commits between the tag and main branch
    const { commitCount, hasCommits } = await compareCommits(octokit, owner, repo, latestTagCommitSha, latestMainCommitSha)

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

    // Create the git tag using GitHub REST API
    await octokit.git.createRef({
      owner,
      ref: `refs/tags/${newVersion}`,
      repo,
      sha: latestMainCommitSha,
    })

    return {
      branchName: undefined,
      changedFiles: [],
      commitMessage: undefined,
      data: {
        message: `Created new tag ${newVersion} with ${commitCount === 1 ? '1 new commit' : `${commitCount} new commits`} since ${latestTagName}. GitHub Actions CI will create the release.`,
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
