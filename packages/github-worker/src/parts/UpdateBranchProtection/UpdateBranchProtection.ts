import type { Octokit } from '@octokit/rest'
import { VError } from '@lvce-editor/verror'
import { Octokit as OctokitConstructor } from '@octokit/rest'

export interface UpdateBranchProtectionOptions {
  readonly branch: string
  readonly githubToken: string
  readonly osVersions?: {
    readonly macos?: string
    readonly ubuntu?: string
    readonly windows?: string
  }
  readonly owner: string
  readonly repo: string
}

export interface UpdateBranchProtectionResult {
  readonly updatedClassicProtection: boolean
  readonly updatedRulesets: number
}

const updateContextOsVersions = (context: string, osVersions: UpdateBranchProtectionOptions['osVersions']): string => {
  if (!osVersions) {
    return context
  }
  let updated = context
  if (osVersions.ubuntu) {
    updated = updated.replaceAll(/ubuntu-\d{2}\.\d{2}/g, `ubuntu-${osVersions.ubuntu}`)
  }
  if (osVersions.windows) {
    updated = updated.replaceAll(/windows-\d{4}/g, `windows-${osVersions.windows}`)
  }
  if (osVersions.macos) {
    updated = updated.replaceAll(/macos-\d+/g, `macos-${osVersions.macos}`)
  }
  return updated
}

const updateBranchRulesetsRequiredChecks = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  osVersions: UpdateBranchProtectionOptions['osVersions'],
): Promise<number> => {
  if (!osVersions) {
    return 0
  }

  // Fetch repository rulesets (branch rules)
  let rulesetsResponse: any
  try {
    rulesetsResponse = await octokit.request('GET /repos/{owner}/{repo}/rulesets', {
      includes_parents: true,
      owner,
      repo,
    })
  } catch (error: any) {
    // If rulesets are not enabled or API not available, skip silently on 404
    // @ts-ignore
    if (error && error.status === 404) {
      return 0
    }
    throw new VError(error as Error, `failed to list rulesets for ${owner}/${repo}`)
  }

  const rulesets: any[] = Array.isArray(rulesetsResponse.data) ? rulesetsResponse.data : []
  let updatedRulesets = 0

  for (const ruleset of rulesets) {
    const originalRules = Array.isArray(ruleset.rules) ? ruleset.rules : []
    let rulesChanged = false

    const newRules = originalRules.map((rule: any) => {
      // Heuristics for required status checks rule. Different orgs might have slightly
      // different shapes; we try to update any "checks" arrays with "context" strings.
      const parameters = rule && rule.parameters ? rule.parameters : undefined
      if (!parameters) {
        return rule
      }

      // candidate property names that may contain status check entries
      const candidatePropNames = ['checks', 'required_checks']

      let updatedRule = rule
      for (const propName of candidatePropNames) {
        const checks = parameters[propName]
        if (!checks || !Array.isArray(checks)) {
          continue
        }

        const newChecks = checks.map((check: any) => {
          if (typeof check === 'string') {
            const newContext = updateContextOsVersions(check, osVersions)
            if (newContext !== check) {
              rulesChanged = true
            }
            return newContext
          }
          if (check && typeof check === 'object' && 'context' in check) {
            const oldContext = String(check.context)
            const newContext = updateContextOsVersions(oldContext, osVersions)
            if (newContext !== oldContext) {
              rulesChanged = true
            }
            return { ...check, context: newContext }
          }
          return check
        })

        if (newChecks !== checks) {
          updatedRule = {
            ...updatedRule,
            parameters: {
              ...updatedRule.parameters,
              [propName]: newChecks,
            },
          }
        }
      }

      // Handle new ruleset shape: parameters.required_status_checks.required_checks
      if (parameters.required_status_checks && Array.isArray(parameters.required_status_checks.required_checks)) {
        const requiredChecks = parameters.required_status_checks.required_checks
        const newRequiredChecks = requiredChecks.map((check: any) => {
          if (typeof check === 'string') {
            const newContext = updateContextOsVersions(check, osVersions)
            if (newContext !== check) {
              rulesChanged = true
            }
            return newContext
          }
          if (check && typeof check === 'object' && 'context' in check) {
            const oldContext = String(check.context)
            const newContext = updateContextOsVersions(oldContext, osVersions)
            if (newContext !== oldContext) {
              rulesChanged = true
            }
            return { ...check, context: newContext }
          }
          return check
        })
        if (newRequiredChecks !== requiredChecks) {
          updatedRule = {
            ...updatedRule,
            parameters: {
              ...updatedRule.parameters,
              required_status_checks: {
                ...updatedRule.parameters.required_status_checks,
                required_checks: newRequiredChecks,
              },
            },
          }
        }
      }

      return updatedRule
    })

    if (!rulesChanged) {
      continue
    }

    // PATCH the ruleset with updated rules, keeping other fields the same
    try {
      const sourceType = ruleset.source && ruleset.source.type
      if (sourceType === 'Organization') {
        await octokit.request('PATCH /orgs/{org}/rulesets/{ruleset_id}', {
          bypass_actors: ruleset.bypass_actors,
          conditions: ruleset.conditions,
          enforcement: ruleset.enforcement,
          name: ruleset.name,
          org: owner,
          rules: newRules,
          ruleset_id: ruleset.id,
          target: ruleset.target,
        })
      } else {
        await octokit.request('PATCH /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
          bypass_actors: ruleset.bypass_actors,
          conditions: ruleset.conditions,
          enforcement: ruleset.enforcement,
          name: ruleset.name,
          owner,
          repo,
          rules: newRules,
          ruleset_id: ruleset.id,
          target: ruleset.target,
        })
      }
      updatedRulesets++
    } catch (error) {
      throw new VError(error as Error, `failed to update ruleset ${String(ruleset && ruleset.id)} for ${owner}/${repo}`)
    }
  }

  return updatedRulesets
}

const updateClassicBranchProtectionRequiredChecks = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  osVersions: UpdateBranchProtectionOptions['osVersions'],
): Promise<boolean> => {
  if (!osVersions) {
    return false
  }

  // Try to fetch existing required status checks; if branch protection is not enabled, skip
  let protection: any
  try {
    protection = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}/protection', {
      branch,
      owner,
      repo,
    })
  } catch (error: any) {
    // @ts-ignore
    if (error && error.status === 404) {
      return false
    }
    throw new VError(error as Error, `failed to get branch protection for ${owner}/${repo}@${branch}`)
  }

  const statusChecks = protection && protection.data && protection.data.required_status_checks ? protection.data.required_status_checks : undefined
  if (!statusChecks) {
    return false
  }
  const strict: boolean = Boolean(statusChecks.strict)
  const contexts: string[] = Array.isArray(statusChecks.contexts) ? statusChecks.contexts : []
  const newContexts = contexts.map((c: string) => updateContextOsVersions(c, osVersions))
  const changed = JSON.stringify(newContexts) !== JSON.stringify(contexts)
  if (!changed) {
    return false
  }

  try {
    await octokit.request('PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks', {
      branch,
      contexts: newContexts,
      owner,
      repo,
      strict,
    })
    return true
  } catch (error) {
    throw new VError(error as Error, `failed to update required status checks for ${owner}/${repo}@${branch}`)
  }
}

export const updateBranchProtection = async (options: UpdateBranchProtectionOptions): Promise<UpdateBranchProtectionResult | undefined> => {
  const { branch, githubToken, osVersions, owner, repo } = options

  if (!osVersions) {
    return undefined
  }

  const octokit: Octokit = new OctokitConstructor({
    auth: githubToken,
  })

  try {
    const updatedRulesets = await updateBranchRulesetsRequiredChecks(octokit, owner, repo, osVersions)
    let updatedClassicProtection = false
    if (updatedRulesets === 0) {
      // Fallback to classic branch protection on main if no rulesets changed
      updatedClassicProtection = await updateClassicBranchProtectionRequiredChecks(octokit, owner, repo, branch, osVersions)
    }
    return {
      updatedClassicProtection,
      updatedRulesets,
    }
  } catch (error) {
    throw new VError(error as Error, `failed to update branch protection for ${owner}/${repo}`)
  }
}
