import { VError } from '@lvce-editor/verror'
import { githubFetch } from '../GithubFetch/GithubFetch.ts'

export interface ClassicBranchProtection {
  readonly allow_deletions?: {
    readonly enabled: boolean
  }
  readonly allow_force_pushes?: {
    readonly enabled: boolean
  }
  readonly enforce_admins?: {
    readonly enabled: boolean
  }
  readonly required_conversation_resolution?: {
    readonly enabled: boolean
  }
  readonly required_linear_history?: {
    readonly enabled: boolean
  }
  readonly required_pull_request_reviews?: {
    readonly dismiss_stale_reviews: boolean
    readonly require_code_owner_reviews: boolean
    readonly required_approving_review_count: number
  }
  readonly required_status_checks?: {
    readonly contexts: readonly string[]
    readonly strict: boolean
  }
  readonly restrictions?: {
    readonly apps: readonly string[]
    readonly teams: readonly string[]
    readonly users: readonly string[]
  }
}

export const getClassicBranchProtection = async (
  repositoryOwner: string,
  repositoryName: string,
  branch: string,
  githubToken: string,
  fetchFn: typeof globalThis.fetch,
): Promise<ClassicBranchProtection | null> => {
  try {
    const protectionUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/branches/${branch}/protection`
    const protectionResponse = await githubFetch(protectionUrl, githubToken, fetchFn)

    if (protectionResponse.status === 200) {
      return protectionResponse.data
    }

    if (protectionResponse.status === 404 || protectionResponse.status === 403) {
      return null
    }

    throw new Error(`GitHub API returned status ${protectionResponse.status}: ${JSON.stringify(protectionResponse.data)}`)
  } catch (error: any) {
    if (error && (error.status === 404 || error.status === 403)) {
      return null
    }
    throw new VError(error, `Failed to fetch classic branch protection`)
  }
}
