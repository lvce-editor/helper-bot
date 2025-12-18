import { githubFetch } from '../GithubFetch/GithubFetch.ts'

export const deleteClassicBranchProtection = async (
  repositoryOwner: string,
  repositoryName: string,
  branch: string,
  githubToken: string,
  fetchFn: typeof globalThis.fetch,
): Promise<{ error?: string; success: boolean }> => {
  try {
    const deleteUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/branches/${branch}/protection`
    const response = await githubFetch(deleteUrl, githubToken, fetchFn, {
      method: 'DELETE',
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
