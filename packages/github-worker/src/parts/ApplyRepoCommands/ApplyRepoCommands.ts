import type { components } from '@octokit/openapi-types'
import type { Octokit } from '@octokit/rest'
import { updateBranchProtectionWithOctokit } from '../UpdateBranchProtection/UpdateBranchProtection.ts'

const GITHUB_ACTIONS_INTEGRATION_ID = 15_368

export interface ModernizeBranchProtectionCommand {
  readonly branch: string
  readonly type: 'modernize-branch-protection'
}

export interface UpdateBranchProtectionChecksCommand {
  readonly branch: string
  readonly osVersions: {
    readonly macos?: string
    readonly ubuntu?: string
    readonly windows?: string
  }
  readonly type: 'update-branch-protection-checks'
}

export type RepoCommand = ModernizeBranchProtectionCommand | UpdateBranchProtectionChecksCommand

interface ClassicBranchProtection {
  readonly allow_deletions?: {
    readonly enabled?: boolean
  }
  readonly required_conversation_resolution?: {
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
}

interface Ruleset {
  readonly id: number
  readonly name: string
  readonly target?: string
}

interface RulesetData {
  readonly bypass_actors: components['schemas']['repository-ruleset-bypass-actor'][]
  readonly conditions: components['schemas']['repository-ruleset-conditions']
  readonly enforcement: components['schemas']['repository-rule-enforcement']
  readonly name: string
  readonly rules: components['schemas']['repository-rule'][]
  readonly target: 'branch'
}

const createDefaultBranchRuleset = (branch: string): RulesetData => {
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
    rules: [
      {
        parameters: {
          allowed_merge_methods: ['squash'],
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_approving_review_count: 0,
          required_review_thread_resolution: false,
        },
        type: 'pull_request',
      },
      {
        parameters: {
          required_status_checks: [
            {
              context: 'pr',
              integration_id: GITHUB_ACTIONS_INTEGRATION_ID,
            },
          ],
          strict_required_status_checks_policy: false,
        },
        type: 'required_status_checks',
      },
      {
        type: 'non_fast_forward',
      },
      {
        type: 'required_linear_history',
      },
      {
        type: 'deletion',
      },
    ],
    target: 'branch',
  }
}

const convertClassicToRuleset = (classicProtection: ClassicBranchProtection, branch: string): RulesetData => {
  const rules: components['schemas']['repository-rule'][] = []

  if (classicProtection.required_pull_request_reviews) {
    const reviews = classicProtection.required_pull_request_reviews
    rules.push({
      parameters: {
        allowed_merge_methods: ['squash'],
        dismiss_stale_reviews_on_push: reviews.dismiss_stale_reviews ?? false,
        require_code_owner_review: reviews.require_code_owner_reviews ?? false,
        require_last_push_approval: false,
        required_approving_review_count: reviews.required_approving_review_count ?? 0,
        required_review_thread_resolution: classicProtection.required_conversation_resolution?.enabled || false,
      },
      type: 'pull_request',
    })
  }

  if (classicProtection.required_status_checks) {
    const statusChecks = classicProtection.required_status_checks
    rules.push({
      parameters: {
        required_status_checks: (statusChecks.contexts ?? []).map((context) => ({
          context,
          integration_id: GITHUB_ACTIONS_INTEGRATION_ID,
        })),
        strict_required_status_checks_policy: statusChecks.strict ?? false,
      },
      type: 'required_status_checks',
    })
  }

  rules.push({
    type: 'non_fast_forward',
  })
  rules.push({
    type: 'required_linear_history',
  })

  if (!classicProtection.allow_deletions?.enabled) {
    rules.push({
      type: 'deletion',
    })
  }

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

const getBranchRulesets = async (octokit: Readonly<Octokit>, owner: string, repo: string): Promise<readonly Ruleset[]> => {
  const response = await octokit.request('GET /repos/{owner}/{repo}/rulesets', {
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
    includes_parents: false,
    owner,
    repo,
  })
  if (Array.isArray(response.data)) {
    return response.data
  }
  return []
}

const getClassicBranchProtection = async (octokit: Readonly<Octokit>, owner: string, repo: string, branch: string): Promise<ClassicBranchProtection | null> => {
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}/protection', {
      branch,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      owner,
      repo,
    })
    return response.data
  } catch (error: any) {
    if (error && (error.status === 403 || error.status === 404)) {
      return null
    }
    throw error
  }
}

const createRuleset = async (octokit: Readonly<Octokit>, owner: string, repo: string, rulesetData: RulesetData): Promise<void> => {
  const response = await octokit.request('POST /repos/{owner}/{repo}/rulesets', {
    ...rulesetData,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
    owner,
    repo,
  })
  if (response.status !== 201) {
    throw new Error(`Failed to create ruleset: ${response.status} - ${JSON.stringify(response.data)}`)
  }
}

const deleteClassicBranchProtection = async (octokit: Readonly<Octokit>, owner: string, repo: string, branch: string): Promise<void> => {
  const response = await octokit.request('DELETE /repos/{owner}/{repo}/branches/{branch}/protection', {
    branch,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
    owner,
    repo,
  })
  if (response.status !== 204) {
    throw new Error(`Failed to delete classic branch protection: ${response.status} - ${JSON.stringify(response.data)}`)
  }
}

const applyModernizeBranchProtection = async (octokit: Readonly<Octokit>, owner: string, repo: string, branch: string): Promise<void> => {
  const rulesets = await getBranchRulesets(octokit, owner, repo)
  const existingRuleset = rulesets.some((ruleset) => {
    return ruleset.target === 'branch' && ruleset.name.toLowerCase().includes(branch.toLowerCase())
  })
  if (existingRuleset) {
    return
  }

  const classicProtection = await getClassicBranchProtection(octokit, owner, repo, branch)
  const rulesetData = classicProtection ? convertClassicToRuleset(classicProtection, branch) : createDefaultBranchRuleset(branch)
  await createRuleset(octokit, owner, repo, rulesetData)
  if (classicProtection) {
    await deleteClassicBranchProtection(octokit, owner, repo, branch)
  }
}

export const applyRepoCommands = async (octokit: Readonly<Octokit>, owner: string, repo: string, repoCommands: readonly RepoCommand[]): Promise<number> => {
  for (const repoCommand of repoCommands) {
    if (repoCommand.type === 'modernize-branch-protection') {
      await applyModernizeBranchProtection(octokit, owner, repo, repoCommand.branch)
      continue
    }
    if (repoCommand.type === 'update-branch-protection-checks') {
      await updateBranchProtectionWithOctokit({
        branch: repoCommand.branch,
        octokit,
        osVersions: repoCommand.osVersions,
        owner,
        repo,
      })
    }
  }
  return repoCommands.length
}
