import type { Octokit } from '@octokit/rest'
import { VError } from '@lvce-editor/verror'
import { Octokit as OctokitConstructor } from '@octokit/rest'

export interface CreateBranchOptions {
  readonly baseBranch?: string
  readonly branchName: string
  readonly githubToken: string
  readonly owner: string
  readonly repo: string
}

export const createBranch = async (options: CreateBranchOptions): Promise<void> => {
  const { baseBranch = 'main', branchName, githubToken, owner, repo } = options

  const octokit: Octokit = new OctokitConstructor({
    auth: githubToken,
  })

  let baseRef
  try {
    baseRef = await octokit.rest.git.getRef({
      owner,
      ref: `heads/${baseBranch}`,
      repo,
    })
  } catch (error) {
    throw new VError(error as Error, `failed to get base ref heads/${baseBranch} for ${owner}/${repo}`)
  }

  try {
    await octokit.rest.git.createRef({
      owner,
      ref: `refs/heads/${branchName}`,
      repo,
      sha: baseRef.data.object.sha,
    })
  } catch (error) {
    throw new VError(error as Error, `failed to create branch ${branchName} for ${owner}/${repo}`)
  }
}
