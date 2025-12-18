import { VError } from '@lvce-editor/verror'
import { githubFetch } from '../GithubFetch/GithubFetch.ts'

export interface Ruleset {
  readonly enforcement: string
  readonly id: number
  readonly name: string
  readonly target: string
}

export const getBranchRulesets = async (
  repositoryOwner: string,
  repositoryName: string,
  githubToken: string,
  fetchFn: typeof globalThis.fetch,
): Promise<Ruleset[]> => {
  try {
    const rulesetsUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/rulesets?includes_parents=false`
    const rulesetsResponse = await githubFetch(rulesetsUrl, githubToken, fetchFn)

    if (rulesetsResponse.status === 200 && Array.isArray(rulesetsResponse.data)) {
      return rulesetsResponse.data
    }
    return []
  } catch (error: any) {
    if (error && error.status === 404) {
      return []
    }
    throw new VError(error, `Failed to fetch branch rulesets`)
  }
}
