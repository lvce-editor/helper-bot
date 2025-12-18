import type { Octokit } from '@octokit/rest'
import { VError } from '@lvce-editor/verror'

export interface Ruleset {
  readonly enforcement: string
  readonly id: number
  readonly name: string
  readonly target: string
}

export const getBranchRulesets = async (repositoryOwner: string, repositoryName: string, octokit: Octokit): Promise<Ruleset[]> => {
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/rulesets', {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      includes_parents: false,
      owner: repositoryOwner,
      repo: repositoryName,
    })

    if (Array.isArray(response.data)) {
      return response.data as Ruleset[]
    }
    return []
  } catch (error: any) {
    if (error && error.status === 404) {
      return []
    }
    throw new VError(error, `Failed to fetch branch rulesets`)
  }
}
