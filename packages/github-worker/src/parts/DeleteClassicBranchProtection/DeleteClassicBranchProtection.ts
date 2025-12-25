import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'

export interface DeleteClassicBranchProtectionOptions {
  readonly branch: string
  readonly githubToken: string
  readonly owner: string
  readonly repo: string
}

export interface DeleteClassicBranchProtectionResult {
  readonly error?: string
  readonly success: boolean
}

export const deleteClassicBranchProtection = async (
  options: DeleteClassicBranchProtectionOptions,
): Promise<DeleteClassicBranchProtectionResult> => {
  const { branch, githubToken, owner, repo } = options

  const octokit: Octokit = new OctokitConstructor({
    auth: githubToken,
  })

  try {
    const response = await octokit.request('DELETE /repos/{owner}/{repo}/branches/{branch}/protection', {
      branch,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      owner,
      repo,
    })

    if (response.status === 204) {
      return {
        success: true,
      }
    }

    return {
      error: `Failed to delete classic branch protection: ${response.status} - ${JSON.stringify(response.data)}`,
      success: false,
    }
  } catch (error: any) {
    return {
      error: `Failed to delete classic branch protection: ${error.message}`,
      success: false,
    }
  }
}
