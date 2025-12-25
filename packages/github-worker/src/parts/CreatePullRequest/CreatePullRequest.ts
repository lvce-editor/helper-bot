import type { Octokit } from '@octokit/rest'
import { VError } from '@lvce-editor/verror'
import { Octokit as OctokitConstructor } from '@octokit/rest'

export interface CreatePullRequestOptions {
  readonly baseBranch: string
  readonly githubToken: string
  readonly headBranch: string
  readonly owner: string
  readonly repo: string
  readonly title: string
}

export interface CreatePullRequestResult {
  readonly pullRequestNumber: number
}

const enableAutoSquash = async (octokit: Octokit, pullRequestData: { data: { node_id: string } }): Promise<void> => {
  await octokit.graphql(
    `mutation MyMutation {
      enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
        clientMutationId
      }
    }`,
  )
}

export const createPullRequest = async (options: CreatePullRequestOptions): Promise<CreatePullRequestResult> => {
  const { baseBranch, githubToken, headBranch, owner, repo, title } = options

  const octokit: Octokit = new OctokitConstructor({
    auth: githubToken,
  })

  try {
    const pullRequestData = await octokit.rest.pulls.create({
      base: baseBranch,
      head: headBranch,
      owner,
      repo,
      title,
    })

    // Enable auto merge squash
    await enableAutoSquash(octokit, pullRequestData)

    return {
      pullRequestNumber: pullRequestData.data.number,
    }
  } catch (error) {
    throw new VError(error as Error, `failed to open pull request from ${headBranch} to ${baseBranch} in ${owner}/${repo}`)
  }
}
