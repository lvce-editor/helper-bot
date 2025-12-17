import type { Context } from 'probot'
import { VError } from '@lvce-editor/verror'

export interface UpdateGithubActionsParams {
  octokit: Context<'release'>['octokit']
  owner: string
  repo: string
  baseBranch?: string
  osVersions: {
    ubuntu?: string
    windows?: string
    macos?: string
  }
}

const WORKFLOWS_DIR = '.github/workflows'

const encodeBase64 = (content: string): string => {
  return Buffer.from(content).toString('base64')
}

const decodeBase64 = (content: string): string => {
  return Buffer.from(content, 'base64').toString()
}

const updateOsVersionsInYaml = (yamlContent: string, osVersions: UpdateGithubActionsParams['osVersions']): string => {
  let updated = yamlContent
  if (osVersions.ubuntu) {
    updated = updated.replace(/ubuntu-\d{2}\.\d{2}/g, `ubuntu-${osVersions.ubuntu}`)
  }
  if (osVersions.windows) {
    updated = updated.replace(/windows-\d{4}/g, `windows-${osVersions.windows}`)
  }
  if (osVersions.macos) {
    updated = updated.replace(/macos-\d+/g, `macos-${osVersions.macos}`)
  }
  return updated
}

const updateContextOsVersions = (context: string, osVersions: UpdateGithubActionsParams['osVersions']): string => {
  let updated = context
  if (osVersions.ubuntu) {
    updated = updated.replace(/ubuntu-\d{2}\.\d{2}/g, `ubuntu-${osVersions.ubuntu}`)
  }
  if (osVersions.windows) {
    updated = updated.replace(/windows-\d{4}/g, `windows-${osVersions.windows}`)
  }
  if (osVersions.macos) {
    updated = updated.replace(/macos-\d+/g, `macos-${osVersions.macos}`)
  }
  return updated
}

const updateBranchRulesetsRequiredChecks = async (params: UpdateGithubActionsParams): Promise<number> => {
  const { octokit, owner, repo, osVersions } = params
  // Fetch repository rulesets (branch rules)
  let rulesetsResponse: any
  try {
    rulesetsResponse = await octokit.request('GET /repos/{owner}/{repo}/rulesets', { owner, repo, includes_parents: true })
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
          org: owner,
          ruleset_id: ruleset.id,
          name: ruleset.name,
          target: ruleset.target,
          enforcement: ruleset.enforcement,
          conditions: ruleset.conditions,
          bypass_actors: ruleset.bypass_actors,
          rules: newRules,
        })
      } else {
        await octokit.request('PATCH /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
          owner,
          repo,
          ruleset_id: ruleset.id,
          name: ruleset.name,
          target: ruleset.target,
          enforcement: ruleset.enforcement,
          conditions: ruleset.conditions,
          bypass_actors: ruleset.bypass_actors,
          rules: newRules,
        })
      }
      updatedRulesets++
    } catch (error) {
      throw new VError(error as Error, `failed to update ruleset ${String(ruleset && ruleset.id)} for ${owner}/${repo}`)
    }
  }

  return updatedRulesets
}

const updateClassicBranchProtectionRequiredChecks = async (params: UpdateGithubActionsParams, branch: string): Promise<boolean> => {
  const { octokit, owner, repo, osVersions } = params
  // Try to fetch existing required status checks; if branch protection is not enabled, skip
  let protection: any
  try {
    protection = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}/protection', { owner, repo, branch })
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
      owner,
      repo,
      branch,
      strict,
      contexts: newContexts,
    })
    return true
  } catch (error) {
    throw new VError(error as Error, `failed to update required status checks for ${owner}/${repo}@${branch}`)
  }
}

export const updateGithubActions = async (params: UpdateGithubActionsParams): Promise<{ changedFiles: number; newBranch?: string } | undefined> => {
  const { octokit, owner, repo, osVersions } = params
  const baseBranch = params.baseBranch || 'main'

  // List workflow files
  let workflows
  try {
    const result = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: WORKFLOWS_DIR,
      ref: baseBranch,
    })
    if (Array.isArray(result.data)) {
      workflows = result.data.filter((entry: any) => {
        return entry.type === 'file' && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))
      })
    } else {
      // Single file case is unexpected for a directory path; bail
      return undefined
    }
  } catch (error: any) {
    if (error && error.status === 404) {
      // No workflows directory, nothing to do
      return undefined
    }
    throw new VError(error as Error, `failed to list workflows at ${WORKFLOWS_DIR} for ${owner}/${repo} on ${baseBranch}`)
  }

  const changed: Array<{
    path: string
    originalSha: string
    newContent: string
  }> = []

  // Fetch and update each workflow file
  for (const file of workflows) {
    const filePath = file.path as string
    try {
      const fileRef = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: baseBranch,
      })
      if (!('content' in fileRef.data)) {
        continue
      }
      const originalSha = fileRef.data.sha as string
      const decoded = decodeBase64(fileRef.data.content as string)
      const updated = updateOsVersionsInYaml(decoded, osVersions)
      if (updated !== decoded) {
        // Ensure trailing newline like repo style
        const finalContent = updated.endsWith('\n') ? updated : updated + '\n'
        changed.push({ path: filePath, originalSha, newContent: finalContent })
      }
    } catch (error) {
      throw new VError(error as Error, `failed to read workflow file ${filePath} for ${owner}/${repo} on ${baseBranch}`)
    }
  }

  if (changed.length === 0) {
    // Even if no workflow files need changes, try to update branch rulesets
    try {
      const updatedRulesets = await updateBranchRulesetsRequiredChecks(params)
      if (updatedRulesets === 0) {
        // Fallback to classic branch protection on main if no rulesets changed
        await updateClassicBranchProtectionRequiredChecks(params, baseBranch)
      }
    } catch (error) {
      throw new VError(error as Error, `failed to update branch rulesets for ${owner}/${repo}`)
    }
    return { changedFiles: 0 }
  }

  // Create a new branch from baseBranch
  const newBranch = `update-gh-actions-${Date.now()}`
  let baseRef
  try {
    baseRef = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    })
  } catch (error) {
    throw new VError(error as Error, `failed to get base ref heads/${baseBranch} for ${owner}/${repo}`)
  }

  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: baseRef.data.object.sha,
    })
  } catch (error) {
    throw new VError(error as Error, `failed to create branch ${newBranch} for ${owner}/${repo}`)
  }

  // Commit updates file-by-file on the new branch
  for (const change of changed) {
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: change.path,
        message: 'ci: update GitHub Actions OS versions',
        content: encodeBase64(change.newContent),
        branch: newBranch,
        sha: change.originalSha,
      })
    } catch (error) {
      throw new VError(error as Error, `failed to commit workflow update to ${change.path} on branch ${newBranch} in ${owner}/${repo}`)
    }
  }

  try {
    await octokit.rest.pulls.create({
      owner,
      repo,
      head: newBranch,
      base: baseBranch,
      title: 'ci: update CI OS versions',
    })
  } catch (error) {
    throw new VError(error as Error, `failed to open pull request from ${newBranch} to ${baseBranch} in ${owner}/${repo}`)
  }

  // After opening the PR, also try to update branch rulesets
  try {
    const updatedRulesets = await updateBranchRulesetsRequiredChecks(params)
    if (updatedRulesets === 0) {
      await updateClassicBranchProtectionRequiredChecks(params, baseBranch)
    }
  } catch (error) {
    throw new VError(error as Error, `failed to update branch rulesets for ${owner}/${repo}`)
  }

  return { changedFiles: changed.length, newBranch }
}
