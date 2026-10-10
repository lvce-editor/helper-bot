import { assertBranchOwnership, planBranches, validateBranches, type ManagedBranch } from './RepositoryBranchProtection.ts'
// Configuration is data: never forward arbitrary keys to privileged GitHub endpoints.
export interface ResourceConfig {
  readonly branches?: readonly ManagedBranch[]
  readonly topics?: readonly string[]
  readonly labels?: readonly Record<string, any>[]
  readonly milestones?: readonly Record<string, any>[]
  readonly environments?: readonly Record<string, any>[]
  readonly collaborators?: readonly Record<string, any>[]
  readonly teams?: readonly Record<string, any>[]
}

const booleanSettings = [
  'allow_squash_merge',
  'allow_merge_commit',
  'allow_rebase_merge',
  'delete_branch_on_merge',
  'allow_auto_merge',
  'allow_update_branch',
  'has_issues',
  'has_projects',
  'has_wiki',
  'has_downloads',
  'has_discussions',
  'is_template',
  'web_commit_signoff_required',
]
const enumSettings: Record<string, readonly string[]> = {
  squash_merge_commit_title: ['PR_TITLE', 'COMMIT_OR_PR_TITLE'],
  squash_merge_commit_message: ['PR_BODY', 'COMMIT_MESSAGES', 'BLANK'],
  merge_commit_title: ['PR_TITLE', 'MERGE_MESSAGE'],
  merge_commit_message: ['PR_BODY', 'PR_TITLE', 'BLANK'],
}
const permissions = ['pull', 'triage', 'push', 'maintain', 'admin']
const record = (value: any): boolean => !!value && typeof value === 'object' && !Array.isArray(value)
const string = (value: any, max: number, empty = false): boolean => typeof value === 'string' && value.length <= max && (empty || value.length > 0)
const fields = (value: any, allowed: readonly string[]): boolean => record(value) && Object.keys(value).every((key) => allowed.includes(key))
const reject = (valid: boolean, message: string): void => {
  if (!valid) throw new Error(message)
}

export const parseResources = (config: any): void => {
  if (config.settings !== undefined) {
    reject(record(config.settings), 'Invalid repository settings')
    for (const [key, value] of Object.entries(config.settings)) {
      const valid = booleanSettings.includes(key)
        ? typeof value === 'boolean'
        : key === 'description'
          ? string(value, 350, true)
          : key === 'homepage'
            ? string(value, 2048, true) && (value === '' || /^https?:\/\//.test(value as string))
            : enumSettings[key]?.includes(value as string)
      reject(!!valid, `Invalid repository setting: ${key}`)
    }
  }
  if (config.topics !== undefined) {
    reject(
      Array.isArray(config.topics) &&
        config.topics.length <= 20 &&
        config.topics.every((topic: any) => typeof topic === 'string' && /^[a-z0-9][a-z0-9-]{0,49}$/.test(topic)) &&
        new Set(config.topics).size === config.topics.length,
      'Invalid topics',
    )
  }
  if (config.branches !== undefined) validateBranches(config.branches)
  const schemas: Record<string, { key: string; valid: (item: any) => boolean }> = {
    labels: {
      key: 'name',
      valid: (item) =>
        fields(item, ['name', 'color', 'description']) && string(item.name, 50) && /^[a-fA-F0-9]{6}$/.test(item.color) && string(item.description, 100, true),
    },
    milestones: {
      key: 'title',
      valid: (item) =>
        fields(item, ['title', 'description', 'state', 'due_on']) &&
        string(item.title, 255) &&
        string(item.description, 10000, true) &&
        ['open', 'closed'].includes(item.state) &&
        (item.due_on === null ||
          (typeof item.due_on === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(item.due_on) && Number.isFinite(Date.parse(item.due_on)))),
    },
    collaborators: {
      key: 'username',
      valid: (item) =>
        fields(item, ['username', 'permission']) &&
        typeof item.username === 'string' &&
        /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(item.username) &&
        permissions.includes(item.permission),
    },
    teams: {
      key: 'name',
      valid: (item) =>
        fields(item, ['name', 'permission']) &&
        typeof item.name === 'string' &&
        /^[a-z0-9][a-z0-9-]{0,99}$/.test(item.name) &&
        permissions.includes(item.permission),
    },
    environments: {
      key: 'name',
      valid: (item) =>
        fields(item, ['name', 'wait_timer', 'reviewers', 'prevent_self_review', 'deployment_branch_policy']) &&
        string(item.name, 255) &&
        Number.isInteger(item.wait_timer) &&
        item.wait_timer >= 0 &&
        item.wait_timer <= 43200 &&
        typeof item.prevent_self_review === 'boolean' &&
        Array.isArray(item.reviewers) &&
        item.reviewers.length <= 6 &&
        item.reviewers.every(
          (reviewer: any) =>
            fields(reviewer, ['type', 'id']) && ['User', 'Team'].includes(reviewer.type) && Number.isSafeInteger(reviewer.id) && reviewer.id > 0,
        ) &&
        new Set(item.reviewers.map((reviewer: any) => `${reviewer.type}/${reviewer.id}`)).size === item.reviewers.length &&
        (item.deployment_branch_policy === null ||
          (fields(item.deployment_branch_policy, ['protected_branches', 'custom_branch_policies']) &&
            item.deployment_branch_policy.protected_branches === true &&
            item.deployment_branch_policy.custom_branch_policies === false)),
    },
  }
  for (const [section, schema] of Object.entries(schemas)) {
    const items = config[section]
    if (items === undefined) continue
    reject(Array.isArray(items) && items.length <= 100 && items.every(schema.valid), `Invalid ${section}`)
    reject(new Set(items.map((item: any) => item[schema.key].toLowerCase())).size === items.length, `Duplicate ${section} identity`)
  }
}

export const assertOwnership = (base: ResourceConfig, desired: ResourceConfig): void => {
  for (const section of ['topics', 'labels', 'milestones', 'environments', 'collaborators', 'teams', 'branches'] as const) {
    if ((base[section] === undefined) !== (desired[section] === undefined)) throw new Error(`Bootstrap managed ${section} on main first`)
  }
  assertBranchOwnership(base.branches || [], desired.branches || [])
}

// Order of mapping keys and set-valued lists is irrelevant to live-state comparisons.
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : record(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value
const same = (left: any, right: any): boolean => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
const snapshot = (live: any, base: any, desired: any, identity: string): void => {
  if (!same(live, base) && !same(live, desired)) throw new Error(`Live resource conflicts: ${identity}`)
}
const role = (value: string): string => ({ read: 'pull', write: 'push' })[value] || value
const requirePermission = (granted: Readonly<Record<string, string>>, permission: string, level = 'write'): void => {
  if (granted[permission] !== 'write' && granted[permission] !== level)
    throw new Error(`GitHub App needs ${permission}: ${level} before applying configuration`)
}

export const planResources = async (
  octokit: any,
  owner: string,
  repo: string,
  base: ResourceConfig,
  desired: ResourceConfig,
  granted: Readonly<Record<string, string>>,
): Promise<readonly (() => Promise<unknown>)[]> => {
  requirePermission(granted, 'administration')
  // Check every required permission before reads or writes, avoiding a predictable partial application.
  if ((desired.labels !== undefined || desired.milestones !== undefined) && granted.pull_requests !== 'write') requirePermission(granted, 'issues')
  if (desired.teams !== undefined) requirePermission(granted, 'members', 'read')
  const writes: (() => Promise<unknown>)[] = []
  if (desired.topics !== undefined) {
    const { data } = await octokit.rest.repos.getAllTopics({ owner, repo })
    snapshot(data.names, base.topics, desired.topics, 'topics')
    if (!same(data.names, desired.topics))
      writes.push(async () => {
        await octokit.rest.repos.replaceAllTopics({ owner, repo, names: desired.topics })
        const { data: updated } = await octokit.rest.repos.getAllTopics({ owner, repo })
        if (!same(updated.names, desired.topics)) throw new Error('Topics write was not confirmed')
      })
  }
  const collections: {
    section: 'labels' | 'milestones' | 'environments' | 'collaborators' | 'teams'
    key: string
    list: string
    normalize: (item: any) => any
    write: (live: any, item: any) => Promise<unknown>
    remove: (live: any) => Promise<unknown>
  }[] = [
    {
      section: 'labels',
      key: 'name',
      list: 'GET /repos/{owner}/{repo}/labels',
      normalize: (item) => ({ name: item.name, color: item.color.toLowerCase(), description: item.description ?? '' }),
      write: (live, item) =>
        live ? octokit.rest.issues.updateLabel({ owner, repo, name: live.name, ...item }) : octokit.rest.issues.createLabel({ owner, repo, ...item }),
      remove: (live) => octokit.rest.issues.deleteLabel({ owner, repo, name: live.name }),
    },
    {
      section: 'milestones',
      key: 'title',
      list: 'GET /repos/{owner}/{repo}/milestones',
      normalize: (item) => ({ title: item.title, description: item.description ?? '', state: item.state, due_on: item.due_on }),
      write: (live, item) =>
        live
          ? octokit.rest.issues.updateMilestone({ owner, repo, milestone_number: live.number, ...item })
          : octokit.rest.issues.createMilestone({ owner, repo, ...item }),
      remove: (live) => octokit.rest.issues.deleteMilestone({ owner, repo, milestone_number: live.number }),
    },
    {
      section: 'environments',
      key: 'name',
      list: 'GET /repos/{owner}/{repo}/environments',
      normalize: (item) => ({
        name: item.name,
        wait_timer: item.protection_rules?.find((rule: any) => rule.type === 'wait_timer')?.wait_timer ?? 0,
        reviewers: (item.protection_rules?.find((rule: any) => rule.type === 'required_reviewers')?.reviewers || []).map((reviewer: any) => ({
          type: reviewer.type,
          id: reviewer.reviewer.id,
        })),
        prevent_self_review: item.protection_rules?.find((rule: any) => rule.type === 'required_reviewers')?.prevent_self_review ?? false,
        deployment_branch_policy: item.deployment_branch_policy,
      }),
      write: (_live, item) => {
        const { name, ...settings } = item
        return octokit.rest.repos.createOrUpdateEnvironment({ owner, repo, environment_name: name, ...settings })
      },
      remove: (live) => octokit.rest.repos.deleteAnEnvironment({ owner, repo, environment_name: live.name }),
    },
    {
      section: 'collaborators',
      key: 'username',
      list: 'GET /repos/{owner}/{repo}/collaborators',
      normalize: (item) => ({ username: item.login, permission: role(item.role_name) }),
      write: (_live, item) => octokit.rest.repos.addCollaborator({ owner, repo, ...item }),
      remove: (live) => octokit.rest.repos.removeCollaborator({ owner, repo, username: live.login }),
    },
    {
      section: 'teams',
      key: 'name',
      list: 'GET /repos/{owner}/{repo}/teams',
      normalize: (item) => ({ name: item.slug, permission: role(item.permission) }),
      write: (_live, item) =>
        octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({ org: owner, owner, repo, team_slug: item.name, permission: item.permission }),
      remove: (live) => octokit.rest.teams.removeRepoInOrg({ org: owner, owner, repo, team_slug: live.slug }),
    },
  ]
  for (const adapter of collections) {
    const after = desired[adapter.section]
    if (after === undefined) continue
    if (adapter.section === 'collaborators') {
      const invitations = await octokit.paginate('GET /repos/{owner}/{repo}/invitations', { owner, repo, per_page: 100 })
      // A successful invitation is not effective access. Do not report it as an applied grant or create duplicates.
      if (invitations.length) throw new Error('Resolve pending collaborator invitations before applying configuration')
    }
    const items = await octokit.paginate(adapter.list, {
      owner,
      repo,
      per_page: 100,
      ...(adapter.section === 'milestones' ? { state: 'all' } : {}),
      ...(adapter.section === 'collaborators' ? { affiliation: 'direct' } : {}),
    })
    const before = base[adapter.section] || []
    const identity = (item: any) => item[adapter.key].toLowerCase()
    const liveMap = new Map<string, any>()
    for (const item of items) {
      const id = identity(adapter.normalize(item))
      if (liveMap.has(id)) throw new Error(`Ambiguous live ${adapter.section}: ${id}`)
      liveMap.set(id, item)
    }
    const beforeMap = new Map(before.map((item) => [identity(item), item]))
    const afterMap = new Map(after.map((item) => [identity(item), item]))
    for (const id of new Set([...beforeMap.keys(), ...afterMap.keys()])) {
      const live = liveMap.get(id)
      const normalizeConfig = (item: any) => (item && adapter.section === 'labels' ? { ...item, color: item.color.toLowerCase() } : item)
      const old = normalizeConfig(beforeMap.get(id))
      const next = normalizeConfig(afterMap.get(id))
      const current = live ? adapter.normalize(live) : undefined
      snapshot(current, old, next, `${adapter.section}/${id}`)
      if (same(current, next)) continue
      if (adapter.section === 'collaborators' && !live && next)
        throw new Error('New collaborator grants may require an invitation; establish accepted access before managing it')
      writes.push(async () => {
        if (next) await adapter.write(live, next)
        else if (live) await adapter.remove(live)
        const updated = await octokit.paginate(adapter.list, {
          owner,
          repo,
          per_page: 100,
          ...(adapter.section === 'milestones' ? { state: 'all' } : {}),
          ...(adapter.section === 'collaborators' ? { affiliation: 'direct' } : {}),
        })
        const matches = updated.map(adapter.normalize).filter((item: any) => identity(item) === id)
        if (matches.length > 1 || !same(matches[0], next)) throw new Error(`Resource write was not confirmed: ${adapter.section}/${id}`)
      })
    }
  }
  writes.push(...(await planBranches(octokit, owner, repo, base.branches || [], desired.branches || [])))
  return writes
}
