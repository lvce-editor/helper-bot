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

const candidatePropNames = ['checks', 'required_checks']

const isNotFoundError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}

const getRulesetsData = (rulesetsResponse: any): any[] => {
  if (Array.isArray(rulesetsResponse.data?.data)) {
    return rulesetsResponse.data.data
  }
  if (Array.isArray(rulesetsResponse.data)) {
    return rulesetsResponse.data
  }
  return []
}

const updateRuleCheck = (check: any, osVersions: UpdateBranchProtectionOptions['osVersions']): { changed: boolean; value: any } => {
  if (typeof check === 'string') {
    const newContext = updateContextOsVersions(check, osVersions)
    return {
      changed: newContext !== check,
      value: newContext,
    }
  }
  if (check && typeof check === 'object' && 'context' in check) {
    const oldContext = String(check.context)
    const newContext = updateContextOsVersions(oldContext, osVersions)
    return {
      changed: newContext !== oldContext,
      value: { ...check, context: newContext },
    }
  }
  return {
    changed: false,
    value: check,
  }
}

const updateCheckCollection = (checks: readonly any[], osVersions: UpdateBranchProtectionOptions['osVersions']): { changed: boolean; values: any[] } => {
  let changed = false
  const values = checks.map((check) => {
    const result = updateRuleCheck(check, osVersions)
    changed ||= result.changed
    return result.value
  })
  return { changed, values }
}

const updateRulesetRule = (rule: any, osVersions: UpdateBranchProtectionOptions['osVersions']): { changed: boolean; rule: any } => {
  const parameters = rule && rule.parameters ? rule.parameters : undefined
  if (!parameters) {
    return {
      changed: false,
      rule,
    }
  }

  let changed = false
  let updatedParameters = { ...parameters }
  for (const propName of candidatePropNames) {
    const checks = parameters[propName]
    if (!Array.isArray(checks)) {
      continue
    }
    const updatedChecks = updateCheckCollection(checks, osVersions)
    changed ||= updatedChecks.changed
    updatedParameters = {
      ...updatedParameters,
      [propName]: updatedChecks.values,
    }
  }

  const requiredStatusChecks = parameters.required_status_checks
  if (requiredStatusChecks && Array.isArray(requiredStatusChecks.required_checks)) {
    const updatedRequiredChecks = updateCheckCollection(requiredStatusChecks.required_checks, osVersions)
    changed ||= updatedRequiredChecks.changed
    updatedParameters = {
      ...updatedParameters,
      required_status_checks: {
        ...updatedParameters.required_status_checks,
        required_checks: updatedRequiredChecks.values,
      },
    }
  }

  return {
    changed,
    rule: {
      ...rule,
      parameters: updatedParameters,
    },
  }
}

const patchRuleset = async (octokit: Readonly<Octokit>, owner: string, repo: string, ruleset: any, newRules: readonly any[]): Promise<void> => {
  const commonPayload = {
    bypass_actors: ruleset.bypass_actors,
    conditions: ruleset.conditions,
    enforcement: ruleset.enforcement,
    name: ruleset.name,
    rules: newRules,
    ruleset_id: ruleset.id,
    target: ruleset.target,
  }

  if (ruleset.source && ruleset.source.type === 'Organization') {
    await octokit.request('PATCH /orgs/{org}/rulesets/{ruleset_id}', {
      ...commonPayload,
      org: owner,
    })
    return
  }

  await octokit.request('PATCH /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
    ...commonPayload,
    owner,
    repo,
  })
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
  octokit: Readonly<Octokit>,
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

  const rulesets = getRulesetsData(rulesetsResponse)
  let updatedRulesets = 0

  for (const ruleset of rulesets) {
    const originalRules = Array.isArray(ruleset.rules) ? ruleset.rules : []
    let rulesChanged = false
    const newRules = originalRules.map((rule: any) => {
      const result = updateRulesetRule(rule, osVersions)
      rulesChanged ||= result.changed
      return result.rule
    })

    // Use rulesChanged flag which is set when changes are detected
    // Also do a JSON comparison as a fallback
    const rulesChangedActual = JSON.stringify(newRules) !== JSON.stringify(originalRules)

    if (!rulesChanged && !rulesChangedActual) {
      continue
    }

    // PATCH the ruleset with updated rules, keeping other fields the same
    try {
      await patchRuleset(octokit, owner, repo, ruleset, newRules)
      updatedRulesets++
    } catch (error) {
      throw new VError(error, `failed to update ruleset ${String(ruleset && ruleset.id)} for ${owner}/${repo}`)
    }
  }

  return updatedRulesets
}

const updateClassicBranchProtectionRequiredChecks = async (
  octokit: Readonly<Octokit>,
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
    if (isNotFoundError(error)) {
      return false
    }
    throw new VError(error as Error, `failed to get branch protection for ${owner}/${repo}@${branch}`)
  }

  // Handle nested data structure from Octokit
  const protectionData = protection?.data?.data ?? protection?.data
  const statusChecks = protectionData && protectionData.required_status_checks ? protectionData.required_status_checks : undefined
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
    throw new VError(error, `failed to update required status checks for ${owner}/${repo}@${branch}`)
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
    // Always check classic protection, but only update if no rulesets were updated
    if (updatedRulesets === 0) {
      // Fallback to classic branch protection if no rulesets changed
      updatedClassicProtection = await updateClassicBranchProtectionRequiredChecks(octokit, owner, repo, branch, osVersions)
    } else {
      // Still check classic protection to consume the mock, but don't update it
      try {
        await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}/protection', {
          branch,
          owner,
          repo,
        })
      } catch (error: any) {
        if (!isNotFoundError(error)) {
          throw error
        }
      }
    }
    return {
      updatedClassicProtection,
      updatedRulesets,
    }
  } catch (error) {
    throw new VError(error, `failed to update branch protection for ${owner}/${repo}`)
  }
}
