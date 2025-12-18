import type { Octokit } from '@octokit/rest'
import type { RulesetData } from '../ConvertClassicToRuleset/ConvertClassicToRuleset.ts'

export const createRuleset = async (
  repositoryOwner: string,
  repositoryName: string,
  octokit: Octokit,
  rulesetData: RulesetData,
): Promise<{ error?: string; rulesetId?: number; success: boolean }> => {
  try {
    const response = await octokit.request('POST /repos/{owner}/{repo}/rulesets', {
      owner: repositoryOwner,
      repo: repositoryName,
      ...rulesetData,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
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
