import { VError } from '@lvce-editor/verror'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

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

const getBranchRulesets = async (
  repositoryOwner: string,
  repositoryName: string,
  githubToken: string,
  fetchFn: typeof globalThis.fetch,
): Promise<any[] | null> => {
  try {
    const rulesetsUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/rulesets?includes_parents=true`
    const rulesetsResponse = await githubFetch(rulesetsUrl, githubToken, fetchFn)

    if (rulesetsResponse.status === 200 && Array.isArray(rulesetsResponse.data) && rulesetsResponse.data.length > 0) {
      return rulesetsResponse.data
    }

    // If rulesets are not available or not accessible, return null
    if (rulesetsResponse.status === 404 || rulesetsResponse.status === 403) {
      return null
    }

    return null
  } catch (error: any) {
    throw new VError(error, `Failed to fetch branch rulesets`)
  }
}

const getClassicBranchProtection = async (
  repositoryOwner: string,
  repositoryName: string,
  branch: string,
  githubToken: string,
  fetchFn: typeof globalThis.fetch,
): Promise<any> => {
  try {
    const protectionUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/branches/${branch}/protection`
    const protectionResponse = await githubFetch(protectionUrl, githubToken, fetchFn)

    if (protectionResponse.status === 200) {
      return protectionResponse.data
    }

    // If branch protection is not enabled (404) or not accessible (403)
    if (protectionResponse.status === 404 || protectionResponse.status === 403) {
      return null
    }

    throw new Error(`GitHub API returned status ${protectionResponse.status}: ${JSON.stringify(protectionResponse.data)}`)
  } catch (error: any) {
    throw new VError(error, `Failed to fetch classic branch protection`)
  }
}

export const getBranchProtection = async (options: GetBranchProtectionOptions): Promise<MigrationResult> => {
  const { branch = 'main', fetch: fetchFn, githubToken, repositoryName, repositoryOwner } = options

  try {
    // Try to get rulesets first (new branch protection)
    const rulesets = await getBranchRulesets(repositoryOwner, repositoryName, githubToken, fetchFn)
    if (rulesets) {
      return {
        changedFiles: [],
        data: {
          data: rulesets,
          type: 'rulesets',
        },
        pullRequestTitle: '',
        status: 'success',
        statusCode: 200,
      }
    }

    // Fall back to classic branch protection
    const classicProtection = await getClassicBranchProtection(repositoryOwner, repositoryName, branch, githubToken, fetchFn)

    if (classicProtection) {
      return {
        changedFiles: [],
        data: {
          data: classicProtection,
          type: 'classic',
        },
        pullRequestTitle: '',
        status: 'success',
        statusCode: 200,
      }
    }

    // No branch protection found
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
  } catch (error) {
    console.error(error)

    return {
      changedFiles: [],
      errorMessage: stringifyError(error),
      status: 'error',
      statusCode: 500,
    }
  }
}
