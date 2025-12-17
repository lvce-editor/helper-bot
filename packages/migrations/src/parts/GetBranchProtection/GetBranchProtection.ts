export interface GetBranchProtectionOptions {
  readonly repositoryOwner: string
  readonly repositoryName: string
  readonly branch?: string
  readonly octokit: any
}

export interface BranchProtectionData {
  readonly type: 'rulesets' | 'classic' | 'none'
  readonly data: any
}

export const getBranchProtection = async (options: GetBranchProtectionOptions): Promise<BranchProtectionData> => {
  const { repositoryOwner, repositoryName, branch = 'main', octokit } = options

  // Try to get rulesets first (new branch protection)
  try {
    const rulesetsResponse = await octokit.request('GET /repos/{owner}/{repo}/rulesets', {
      owner: repositoryOwner,
      repo: repositoryName,
      includes_parents: true,
    })

    if (rulesetsResponse.data && Array.isArray(rulesetsResponse.data) && rulesetsResponse.data.length > 0) {
      return {
        type: 'rulesets',
        data: rulesetsResponse.data,
      }
    }
  } catch (error: any) {
    // If rulesets are not enabled or API not available, fall through to classic protection
    if (error && error.status !== 404) {
      throw error
    }
  }

  // Fall back to classic branch protection
  try {
    const protectionResponse = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}/protection', {
      owner: repositoryOwner,
      repo: repositoryName,
      branch,
    })

    return {
      type: 'classic',
      data: protectionResponse.data,
    }
  } catch (error: any) {
    // If branch protection is not enabled
    if (error && error.status === 404) {
      return {
        type: 'none',
        data: null,
      }
    }
    throw error
  }
}

