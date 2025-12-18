import type { Octokit } from '@octokit/rest'

export const deleteClassicBranchProtection = async (
  repositoryOwner: string,
  repositoryName: string,
  branch: string,
  octokit: Octokit,
): Promise<{ error?: string; success: boolean }> => {
  try {
    const response = await octokit.request('DELETE /repos/{owner}/{repo}/branches/{branch}/protection', {
      branch,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      owner: repositoryOwner,
      repo: repositoryName,
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
