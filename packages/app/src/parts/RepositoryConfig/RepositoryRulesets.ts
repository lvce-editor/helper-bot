import { Ajv } from 'ajv'
import { rulesetSchema } from './RepositoryRulesetSchema.ts'

export interface ManagedRuleset {
  readonly name: string
  readonly target: 'branch' | 'tag' | 'push'
  readonly enforcement: 'active' | 'disabled' | 'evaluate'
  readonly conditions: Readonly<Record<string, any>>
  readonly bypass_actors: readonly Readonly<Record<string, any>>[]
  readonly rules: readonly Readonly<Record<string, any>>[]
}

const validate = new Ajv({ formats: { float: true } }).compile<ManagedRuleset>(rulesetSchema)
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value
const same = (left: any, right: any): boolean => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
const payload = (value: any): ManagedRuleset => ({
  name: value.name,
  target: value.target,
  enforcement: value.enforcement,
  conditions: value.conditions ?? {},
  bypass_actors: value.bypass_actors ?? [],
  rules: value.rules,
})

export const validateRulesets = (items: any): void => {
  if (
    !Array.isArray(items) ||
    items.length > 100 ||
    items.some(
      (item) =>
        !validate(item) ||
        !item.name.length ||
        item.name.length > 100 ||
        item.rules.length > 100 ||
        new Set(item.rules.map((rule: any) => rule.type)).size !== item.rules.length,
    ) ||
    new Set(items.map((item) => item.name.toLowerCase())).size !== items.length
  )
    throw new Error('Invalid repository rulesets')
}

// Any managed check rule must retain the complete intended matrix, bound to GitHub Actions.
// The existing classic protection/legacy ruleset remains the mandatory main CI gate.
export const assertRulesetChecks = (items: readonly ManagedRuleset[], checks: readonly string[]): void => {
  for (const item of items) {
    for (const rule of item.rules) {
      if (rule.type !== 'required_status_checks') continue
      const required = rule.parameters.required_status_checks
      if (
        required.some((check: any) => check.integration_id !== 15368) ||
        !same(
          required.map((check: any) => check.context),
          checks,
        )
      ) {
        throw new Error('Ruleset checks must match the complete workflow matrix and GitHub Actions identity')
      }
    }
  }
}

export const planRulesets = async (
  octokit: any,
  owner: string,
  repo: string,
  base: readonly ManagedRuleset[],
  desired: readonly ManagedRuleset[],
  legacyId?: number,
): Promise<readonly (() => Promise<unknown>)[]> => {
  const summaries = await octokit.paginate('GET /repos/{owner}/{repo}/rulesets', { owner, repo, includes_parents: true, per_page: 100 })
  const before = new Map(base.map((item) => [item.name.toLowerCase(), item]))
  const after = new Map(desired.map((item) => [item.name.toLowerCase(), item]))
  const writes: (() => Promise<unknown>)[] = []
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const matches = summaries.filter((item: any) => item.name.toLowerCase() === name)
    if (matches.length > 1) throw new Error(`Ambiguous ruleset identity: ${name}`)
    const summary = matches[0]
    const old = before.get(name)
    const next = after.get(name)
    let live: any
    if (summary) {
      if (summary.id === legacyId) throw new Error('Full ruleset ownership cannot overlap the mandatory legacy CI ruleset')
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', { owner, repo, ruleset_id: summary.id })
      if (data.source_type !== 'Repository' || data.source !== `${owner}/${repo}`) throw new Error('Cannot manage inherited organization rulesets')
      live = data
    }
    const current = live ? payload(live) : undefined
    if (!same(current, old) && !same(current, next)) throw new Error(`Live ruleset conflicts: ${name}`)
    if (same(current, next)) continue
    writes.push(async () => {
      if (next) {
        const route = live ? 'PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}' : 'POST /repos/{owner}/{repo}/rulesets'
        const { data: updated } = await octokit.request(route, { owner, repo, ...(live ? { ruleset_id: live.id } : {}), ...next })
        const { data: effective } = await octokit.request('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', { owner, repo, ruleset_id: updated.id })
        if (effective.source_type !== 'Repository' || effective.source !== `${owner}/${repo}` || !same(payload(effective), next)) {
          throw new Error(`Ruleset write was not confirmed: ${name}`)
        }
      } else {
        await octokit.request('DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}', { owner, repo, ruleset_id: live.id })
        try {
          await octokit.request('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', { owner, repo, ruleset_id: live.id })
        } catch (error: any) {
          if (error.status === 404) return
          throw error
        }
        throw new Error(`Ruleset removal was not confirmed: ${name}`)
      }
    })
  }
  return writes
}
