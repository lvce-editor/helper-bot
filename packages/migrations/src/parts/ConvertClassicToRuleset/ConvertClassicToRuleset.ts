import type { components } from '@octokit/openapi-types'
import type { ClassicBranchProtection } from '../GetClassicBranchProtection/GetClassicBranchProtection.ts'

export interface RulesetData {
  enforcement: components['schemas']['repository-rule-enforcement']
  bypass_actors?: components['schemas']['repository-ruleset-bypass-actor'][]
  conditions?: components['schemas']['repository-ruleset-conditions']
  rules?: components['schemas']['repository-rule'][]
  name: string
  target: string
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

  // Deletion protection
  if (!classicProtection.allow_deletions?.enabled) {
    rules.push({
      type: 'deletion',
    })
  }

  // Update protection (force pushes)
  if (!classicProtection.allow_force_pushes?.enabled) {
    rules.push({
      parameters: {
        update_allows_fetch_and_merge: false,
      },
      type: 'update',
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

  // Add bypass actors if enforcement is disabled for admins
  if (classicProtection.enforce_admins?.enabled === false) {
    ruleset.bypass_actors.push({
      actor_id: 5, // Repository admins
      actor_type: 'RepositoryRole',
      bypass_mode: 'always',
    })
  }

  return ruleset
}
