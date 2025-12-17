export interface GetBranchProtectionOptions {
  readonly repositoryOwner: string
  readonly repositoryName: string
  readonly branch?: string
  readonly githubToken: string
}

export interface BranchProtectionData {
  readonly type: 'rulesets' | 'classic' | 'none'
  readonly data: any
}

const githubFetch = async (url: string, token: string): Promise<{ status: number; data: any }> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  let data: any = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  return {
    status: response.status,
    data,
  }
}

export const getBranchProtection = async (options: GetBranchProtectionOptions): Promise<BranchProtectionData> => {
  const { repositoryOwner, repositoryName, branch = 'main', githubToken } = options

  // Try to get rulesets first (new branch protection)
  try {
    const rulesetsUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/rulesets?includes_parents=true`
    const rulesetsResponse = await githubFetch(rulesetsUrl, githubToken)

    if (rulesetsResponse.status === 200 && Array.isArray(rulesetsResponse.data) && rulesetsResponse.data.length > 0) {
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
    const protectionUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/branches/${branch}/protection`
    const protectionResponse = await githubFetch(protectionUrl, githubToken)

    if (protectionResponse.status === 200) {
      return {
        type: 'classic',
        data: protectionResponse.data,
      }
    }

    // If branch protection is not enabled (404)
    if (protectionResponse.status === 404) {
      return {
        type: 'none',
        data: null,
      }
    }

    throw new Error(`GitHub API returned status ${protectionResponse.status}: ${JSON.stringify(protectionResponse.data)}`)
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
