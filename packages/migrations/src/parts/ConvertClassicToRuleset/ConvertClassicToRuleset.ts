import type { ClassicBranchProtection } from '../GetClassicBranchProtection/GetClassicBranchProtection.ts'

export const convertClassicToRuleset = (classicProtection: ClassicBranchProtection, branch: string): any => {
  const rules: any[] = []

  // Pull request required
  if (classicProtection.required_pull_request_reviews) {
    const reviews = classicProtection.required_pull_request_reviews
    rules.push({
      parameters: {
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

  // Non-fast-forward (linear history)
  if (classicProtection.required_linear_history?.enabled) {
    rules.push({
      type: 'non_fast_forward',
    })
  }

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

  const ruleset: any = {
    bypass_actors: [],
    conditions: {
      ref_name: {
        exclude: [],
        include: [`refs/heads/${branch}`],
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
