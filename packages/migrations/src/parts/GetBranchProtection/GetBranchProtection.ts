import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface GetBranchProtectionOptions extends BaseMigrationOptions {
  readonly branch?: string
  readonly githubToken: string
}

export interface BranchProtectionData {
  readonly data: any
  readonly type: 'rulesets' | 'classic' | 'none'
}

const githubFetch = async (url: string, token: string, fetchFn: typeof globalThis.fetch): Promise<{ status: number; data: any }> => {
  const response = await fetchFn(url, {
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

export const getBranchProtection = async (options: GetBranchProtectionOptions): Promise<MigrationResult> => {
  const { branch = 'main', fetch: fetchFn, githubToken, repositoryName, repositoryOwner } = options

  try {
    // Try to get rulesets first (new branch protection)
    try {
      const rulesetsUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/rulesets?includes_parents=true`
      const rulesetsResponse = await githubFetch(rulesetsUrl, githubToken, fetchFn)

      if (rulesetsResponse.status === 200 && Array.isArray(rulesetsResponse.data) && rulesetsResponse.data.length > 0) {
        return {
          changedFiles: [],
          data: {
            data: rulesetsResponse.data,
            type: 'rulesets',
          },
          pullRequestTitle: '',
          status: 'success',
          statusCode: 200,
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
      const protectionResponse = await githubFetch(protectionUrl, githubToken, fetchFn)

      if (protectionResponse.status === 200) {
        return {
          changedFiles: [],
          data: {
            data: protectionResponse.data,
            type: 'classic',
          },
          pullRequestTitle: '',
          status: 'success',
          statusCode: 200,
        }
      }

      // If branch protection is not enabled (404)
      if (protectionResponse.status === 404) {
        return {
          changedFiles: [],
          data: {
            data: null,
            type: 'none',
          },
          pullRequestTitle: '',
          status: 'success',
          statusCode: 200,
        }
      }

      throw new Error(`GitHub API returned status ${protectionResponse.status}: ${JSON.stringify(protectionResponse.data)}`)
    } catch (error: any) {
      // If branch protection is not enabled
      if (error && error.status === 404) {
        return {
          changedFiles: [],
          data: {
            data: null,
            type: 'none',
          },
          pullRequestTitle: '',
          status: 'success',
          statusCode: 200,
        }
      }
      throw error
    }
  } catch (error) {
    let errorMessage: string
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    } else {
      errorMessage = 'Unknown error'
    }
    return {
      changedFiles: [],
      errorMessage,
      status: 'error',
      statusCode: 500,
    }
  }
}
