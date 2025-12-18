import type { Octokit } from '@octokit/rest'
import { VError } from '@lvce-editor/verror'

export interface ClassicBranchProtection {
  readonly allow_deletions?: {
    readonly enabled?: boolean
  }
  readonly allow_force_pushes?: {
    readonly enabled?: boolean
  }
  readonly enforce_admins?: {
    readonly enabled?: boolean
  }
  readonly required_conversation_resolution?: {
    readonly enabled?: boolean
  }
  readonly required_linear_history?: {
    readonly enabled?: boolean
  }
  readonly required_pull_request_reviews?: {
    readonly dismiss_stale_reviews?: boolean
    readonly require_code_owner_reviews?: boolean
    readonly required_approving_review_count?: number
  }
  readonly required_status_checks?: {
    readonly contexts?: readonly string[]
    readonly strict?: boolean
  }
  readonly restrictions?: {
    readonly apps?: readonly any[]
    readonly teams?: readonly any[]
    readonly users?: readonly any[]
  }
}

export const getClassicBranchProtection = async (
  repositoryOwner: string,
  repositoryName: string,
  branch: string,
  octokit: Octokit,
): Promise<ClassicBranchProtection | null> => {
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}/protection', {
      branch,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      owner: repositoryOwner,
      repo: repositoryName,
    })

    return response.data
  } catch (error: any) {
    if (error && (error.status === 404 || error.status === 403)) {
      return null
    }
    throw new VError(error, `Failed to fetch classic branch protection`)
  }
}
