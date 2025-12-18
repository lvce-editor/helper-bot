import { githubFetch } from '../GithubFetch/GithubFetch.ts'

export const createRuleset = async (
  repositoryOwner: string,
  repositoryName: string,
  githubToken: string,
  fetchFn: typeof globalThis.fetch,
  rulesetData: any,
): Promise<{ error?: string; rulesetId?: number; success: boolean }> => {
  try {
    const createUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/rulesets`
    const response = await githubFetch(createUrl, githubToken, fetchFn, {
      body: JSON.stringify(rulesetData),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (response.status === 201) {
      return {
        rulesetId: response.data.id,
        success: true,
      }
    }

    return {
      error: `Failed to create ruleset: ${response.status} - ${JSON.stringify(response.data)}`,
      success: false,
    }
  } catch (error: any) {
    return {
      error: `Failed to create ruleset: ${error.message}`,
      success: false,
    }
  }
}
