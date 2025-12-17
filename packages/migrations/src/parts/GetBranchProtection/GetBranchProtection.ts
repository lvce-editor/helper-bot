export interface GetBranchProtectionOptions {
  readonly branch?: string
  readonly githubToken: string
  readonly repositoryName: string
  readonly repositoryOwner: string
}

export interface BranchProtectionData {
  readonly data: any
  readonly type: 'rulesets' | 'classic' | 'none'
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
    data,
    status: response.status,
  }
}

export const getBranchProtection = async (options: GetBranchProtectionOptions): Promise<BranchProtectionData> => {
  const { branch = 'main', githubToken, repositoryName, repositoryOwner } = options

  // Try to get rulesets first (new branch protection)
  try {
    const rulesetsUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/rulesets?includes_parents=true`
    const rulesetsResponse = await githubFetch(rulesetsUrl, githubToken)

    if (rulesetsResponse.status === 200 && Array.isArray(rulesetsResponse.data) && rulesetsResponse.data.length > 0) {
      return {
        data: rulesetsResponse.data,
        type: 'rulesets',
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
        data: protectionResponse.data,
        type: 'classic',
      }
    }

    // If branch protection is not enabled (404)
    if (protectionResponse.status === 404) {
      return {
        data: null,
        type: 'none',
      }
    }

    throw new Error(`GitHub API returned status ${protectionResponse.status}: ${JSON.stringify(protectionResponse.data)}`)
  } catch (error: any) {
    // If branch protection is not enabled
    if (error && error.status === 404) {
      return {
        data: null,
        type: 'none',
      }
    }
    throw error
  }
}
