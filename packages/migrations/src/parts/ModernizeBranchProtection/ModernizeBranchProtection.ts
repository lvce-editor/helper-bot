import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import type { components } from '@octokit/openapi-types'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { convertClassicToRuleset, type RulesetData } from '../ConvertClassicToRuleset/ConvertClassicToRuleset.ts'
import { createRuleset } from '../CreateRuleset/CreateRuleset.ts'
import { deleteClassicBranchProtection } from '../DeleteClassicBranchProtection/DeleteClassicBranchProtection.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getBranchRulesets } from '../GetBranchRulesets/GetBranchRulesets.ts'
import { getClassicBranchProtection } from '../GetClassicBranchProtection/GetClassicBranchProtection.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export interface ModernizeBranchProtectionOptions extends BaseMigrationOptions {
  readonly branch?: string
  readonly githubToken: string
  readonly OctokitConstructor?: typeof OctokitConstructor
}

const createDefaultBranchRuleset = (branch: string): RulesetData => {
  const rules: components['schemas']['repository-rule'][] = [
    // Non-fast-forward (linear history) - always enabled
    {
      type: 'non_fast_forward',
    },
    {
      type: 'required_linear_history',
    },
    // Deletion protection - always enabled for default ruleset
    {
      type: 'deletion',
    },
  ]

  return {
    bypass_actors: [],
    conditions: {
      ref_name: {
        exclude: [],
        include: ['~DEFAULT_BRANCH'],
      },
    },
    enforcement: 'active',
    name: `Protect ${branch}`,
    rules,
    target: 'branch',
  }
}

export const modernizeBranchProtection = async (options: ModernizeBranchProtectionOptions): Promise<MigrationResult> => {
  const { branch = 'main', githubToken, OctokitConstructor: OctokitCtor = OctokitConstructor, repositoryName, repositoryOwner } = options

  const octokit: Octokit = new OctokitCtor({
    auth: githubToken,
  })

  try {
    // Get existing rulesets first
    const rulesets = await getBranchRulesets(repositoryOwner, repositoryName, octokit)

    // Check if there's already a ruleset for this branch
    const existingRuleset = rulesets.find((ruleset) => {
      return ruleset.target === 'branch' && ruleset.name.toLowerCase().includes(branch.toLowerCase())
    })

    if (existingRuleset) {
      return {
        changedFiles: [],
        data: {
          message: 'Ruleset already exists for this branch',
          migrated: false,
          rulesetId: existingRuleset.id,
        },
        pullRequestTitle: '',
        status: 'success',
        statusCode: 200,
      }
    }

    // Get classic branch protection
    const classicProtection = await getClassicBranchProtection(repositoryOwner, repositoryName, branch, octokit)

    let rulesetData: RulesetData
    let shouldDeleteClassic = false

    if (classicProtection) {
      // Convert classic to ruleset format
      rulesetData = convertClassicToRuleset(classicProtection, branch)
      shouldDeleteClassic = true
    } else {
      // No classic protection found, create default branch ruleset
      rulesetData = createDefaultBranchRuleset(branch)
    }

    // Create the new ruleset
    const createResult = await createRuleset(repositoryOwner, repositoryName, octokit, rulesetData)

    if (!createResult.success) {
      return createMigrationResult({
        errorCode: ERROR_CODES.CREATE_RULESET_FAILED,
        errorMessage: createResult.error || 'Failed to create ruleset',
        status: 'error',
      })
    }

    // Delete the classic branch protection if it existed
    if (shouldDeleteClassic) {
      const deleteResult = await deleteClassicBranchProtection(repositoryOwner, repositoryName, branch, octokit)

      if (!deleteResult.success) {
        return createMigrationResult({
          errorCode: ERROR_CODES.DELETE_CLASSIC_PROTECTION_FAILED,
          errorMessage: deleteResult.error || 'Failed to delete classic branch protection',
          status: 'error',
        })
      }

      return {
        changedFiles: [],
        data: {
          message: 'Successfully migrated branch protection from classic to rulesets',
          migrated: true,
          rulesetId: createResult.rulesetId,
        },
        pullRequestTitle: '',
        status: 'success',
        statusCode: 200,
      }
    }

    return {
      changedFiles: [],
      data: {
        message: 'Successfully created default branch ruleset',
        migrated: true,
        rulesetId: createResult.rulesetId,
      },
      pullRequestTitle: '',
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.MODERNIZE_BRANCH_PROTECTION_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
