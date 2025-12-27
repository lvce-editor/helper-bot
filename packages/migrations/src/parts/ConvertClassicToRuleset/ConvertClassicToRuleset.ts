import type { components } from '@octokit/openapi-types'
import type { ClassicBranchProtection } from '../GetClassicBranchProtection/GetClassicBranchProtection.ts'
import { GITHUB_ACTIONS_INTEGRATION_ID } from '../Constants/Constants.ts'

export interface RulesetData {
  bypass_actors?: components['schemas']['repository-ruleset-bypass-actor'][]
  conditions?: components['schemas']['repository-ruleset-conditions']
  enforcement: components['schemas']['repository-rule-enforcement']
  name: string
  rules?: components['schemas']['repository-rule'][]
  target: 'branch' | 'tag' | 'push'
}

export const convertClassicToRuleset = (classicProtection: ClassicBranchProtection, branch: string): RulesetData => {
  const rules: components['schemas']['repository-rule'][] = []

  // Pull request required
  if (classicProtection.required_pull_request_reviews) {
    const reviews = classicProtection.required_pull_request_reviews
    rules.push({
      parameters: {
        allowed_merge_methods: ['squash'],
        dismiss_stale_reviews_on_push: reviews.dismiss_stale_reviews,
        require_code_owner_review: reviews.require_code_owner_reviews,
        require_last_push_approval: false,
        required_approving_review_count: reviews.required_approving_review_count,
        required_review_thread_resolution: classicProtection.required_conversation_resolution?.enabled || false,
      },
      type: 'pull_request',
    })
  }

  // Required status checks
  if (classicProtection.required_status_checks) {
    const statusChecks = classicProtection.required_status_checks
    rules.push({
      parameters: {
        required_status_checks: statusChecks.contexts.map((context) => ({
          context,
          integration_id: GITHUB_ACTIONS_INTEGRATION_ID,
        })),
        strict_required_status_checks_policy: statusChecks.strict,
      },
      type: 'required_status_checks',
    })
  }

  // Non-fast-forward (linear history) - always enabled
  rules.push({
    type: 'non_fast_forward',
  })

  rules.push({
    type: 'required_linear_history',
  })

  // Deletion protection
  if (!classicProtection.allow_deletions?.enabled) {
    rules.push({
      type: 'deletion',
    })
  }

  const ruleset: RulesetData = {
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

  return ruleset
}
