import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { getBranchRulesets } from '../GetBranchRulesets/GetBranchRulesets.ts'
import { getClassicBranchProtection } from '../GetClassicBranchProtection/GetClassicBranchProtection.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export interface GetBranchProtectionOptions extends BaseMigrationOptions {
  readonly branch?: string
  readonly githubToken: string
  readonly OctokitConstructor?: typeof OctokitConstructor
}

export interface BranchProtectionData {
  readonly data: any
  readonly type: 'rulesets' | 'classic' | 'none'
}

export const getBranchProtection = async (options: GetBranchProtectionOptions): Promise<MigrationResult> => {
  const { branch = 'main', githubToken, OctokitConstructor: OctokitCtor = OctokitConstructor, repositoryName, repositoryOwner } = options

  const octokit: Octokit = new OctokitCtor({
    auth: githubToken,
  })

  try {
    // Try to get rulesets first (new branch protection)
    const rulesets = await getBranchRulesets(repositoryOwner, repositoryName, octokit)
    if (rulesets && rulesets.length > 0) {
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
    const classicProtection = await getClassicBranchProtection(repositoryOwner, repositoryName, branch, octokit)

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
