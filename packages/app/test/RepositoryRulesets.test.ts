import { expect, jest, test } from '@jest/globals'
import { assertRulesetChecks, planRulesets, validateRulesets } from '../src/parts/RepositoryConfig/RepositoryRulesets.ts'
import { parseConfig } from '../src/parts/RepositoryConfig/RepositoryConfig.ts'
import { assertOwnership } from '../src/parts/RepositoryConfig/RepositoryResources.ts'

const ruleset = {
  name: 'Protect release tags',
  target: 'tag' as const,
  enforcement: 'active' as const,
  conditions: { ref_name: { include: ['refs/tags/v*'], exclude: [] } },
  bypass_actors: [{ actor_id: 7, actor_type: 'Integration', bypass_mode: 'always' }],
  rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
}
const fixture = (initial: any[] = []) => {
  let live = structuredClone(initial)
  let nextId = 100
  const request = jest.fn<(route: string, options: any) => Promise<any>>().mockImplementation(async (route, options) => {
    const index = live.findIndex((item: any) => item.id === options.ruleset_id)
    if (route.startsWith('GET ')) {
      if (index < 0) throw Object.assign(new Error('Missing'), { status: 404 })
      return { data: structuredClone(live[index]) }
    }
    if (route.startsWith('DELETE ')) {
      live.splice(index, 1)
      return {}
    }
    const { owner, repo, ruleset_id, ...data } = options
    const result = { ...data, id: ruleset_id || nextId++, source_type: 'Repository', source: `${owner}/${repo}` }
    if (index < 0) live.push(result)
    else live[index] = result
    return { data: result }
  })
  const octokit: any = { request, paginate: jest.fn<() => Promise<any>>().mockImplementation(async () => structuredClone(live)) }
  const run = async (before: any[], after: any[], legacy?: number) => {
    for (const write of await planRulesets(octokit, 'lvce-editor', 'about-view', before, after, legacy)) await write()
  }
  return { octokit, request, run, live: () => live }
}

test('full rulesets parse conditions, bypass actors and parameterized rules from the pinned GitHub schema', () => {
  const branch = {
    ...ruleset,
    target: 'branch',
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: true,
          require_last_push_approval: true,
          required_review_thread_resolution: true,
          allowed_merge_methods: ['squash'],
        },
      },
      { type: 'commit_message_pattern', parameters: { name: 'Issue', negate: false, operator: 'starts_with', pattern: 'fix:' } },
    ],
  }
  expect(() => validateRulesets([branch])).not.toThrow()
  expect(parseConfig(JSON.stringify({ version: 1, requiredStatusChecks: ['pr'], rulesets: [ruleset] })).rulesets).toEqual([ruleset])
  expect(() => assertOwnership({}, { rulesets: [] })).toThrow('Bootstrap')
  expect(() => assertOwnership({ rulesets: [] }, { rulesets: [ruleset] })).not.toThrow()
})

test.each([
  { ...ruleset, id: 1 },
  { ...ruleset, target: 'organization' },
  { ...ruleset, enforcement: 'enabled' },
  { ...ruleset, conditions: { repository_name: { include: ['*'] } } },
  { ...ruleset, rules: [{ type: 'unknown_rule' }] },
  { ...ruleset, rules: [{ type: 'deletion', parameters: { arbitrary: true } }] },
  { ...ruleset, rules: [{ type: 'pull_request', parameters: { required_approving_review_count: '1' } }] },
  { ...ruleset, bypass_actors: [{ actor_type: 'User', actor_id: '7' }] },
  { ...ruleset, rules: [{ type: 'deletion' }, { type: 'deletion' }] },
])('rejects invalid ruleset data %j', (item) => expect(() => validateRulesets([item])).toThrow())

test('duplicate names and unknown nested fields reject before privileged API reads', () => {
  expect(() => validateRulesets([ruleset, { ...ruleset, name: ruleset.name.toUpperCase() }])).toThrow()
  expect(() =>
    validateRulesets([{ ...ruleset, rules: [{ type: 'commit_message_pattern', parameters: { operator: 'regex', pattern: '.*', secret: true } }] }]),
  ).toThrow()
})

test('creates, updates and deletes managed rulesets, with duplicates no-ops and unmanaged rulesets preserved', async () => {
  const unmanaged = { ...ruleset, name: 'Unmanaged', id: 9, source_type: 'Repository', source: 'lvce-editor/about-view' }
  const { run, live, request } = fixture([unmanaged])
  await run([], [ruleset])
  await run([], [ruleset])
  expect(request.mock.calls.filter(([route]) => route.startsWith('POST '))).toHaveLength(1)
  const changed = { ...ruleset, enforcement: 'disabled', conditions: { ref_name: { include: ['~ALL'], exclude: [] } }, bypass_actors: [], rules: [] }
  await run([ruleset], [changed])
  expect(live().find((item: any) => item.name === ruleset.name)).toMatchObject(changed)
  await run([changed], [])
  await run([changed], [])
  expect(live()).toEqual([unmanaged])
})

test('preflights all rulesets, rejecting external changes, inherited ownership and legacy CI overlap', async () => {
  const live = { ...ruleset, id: 9, source_type: 'Repository', source: 'lvce-editor/about-view' }
  const { octokit, request } = fixture([{ ...live, enforcement: 'disabled' }])
  await expect(planRulesets(octokit, 'lvce-editor', 'about-view', [ruleset], [ruleset])).rejects.toThrow('conflicts')
  expect(request.mock.calls.every(([route]) => route.startsWith('GET '))).toBe(true)
  const inherited = fixture([{ ...live, source_type: 'Organization', source: 'lvce-editor' }])
  await expect(inherited.run([ruleset], [ruleset])).rejects.toThrow('inherited')
  const legacy = fixture([live])
  await expect(legacy.run([ruleset], [ruleset], 9)).rejects.toThrow('overlap')
  const ambiguous = fixture([live, { ...live, id: 10 }])
  await expect(ambiguous.run([ruleset], [ruleset])).rejects.toThrow('Ambiguous')
})

test('retry reconciles a partial application and an uncertain create response without duplicating rulesets', async () => {
  const { octokit, request, run, live } = fixture()
  const second = { ...ruleset, name: 'Second' }
  const original = request.getMockImplementation()!
  let failed = false
  request.mockImplementation(async (route, options) => {
    const result = await original(route, options)
    if (route.startsWith('POST ') && !failed) {
      failed = true
      throw new Error('Response lost')
    }
    return result
  })
  await expect(run([], [ruleset, second])).rejects.toThrow('Response lost')
  await run([], [ruleset, second])
  expect(live()).toHaveLength(2)
  expect(await planRulesets(octokit, 'lvce-editor', 'about-view', [], [ruleset, second])).toHaveLength(0)
})

test('HTTP success without effective state is rejected for updates and removals', async () => {
  const live = { ...ruleset, id: 9, source_type: 'Repository', source: 'lvce-editor/about-view' }
  const fixtureUpdate = fixture([live])
  const original = fixtureUpdate.request.getMockImplementation()!
  fixtureUpdate.request.mockImplementation(async (route, options) => (route.startsWith('GET ') ? original(route, options) : { data: live }))
  await expect(fixtureUpdate.run([ruleset], [{ ...ruleset, enforcement: 'disabled' }])).rejects.toThrow('not confirmed')
  await expect(fixtureUpdate.run([ruleset], [])).rejects.toThrow('not confirmed')
})

test('ruleset check parameters cannot omit a platform or substitute a status provider', () => {
  const checks = ['pr (ubuntu-24.04)', 'pr (macos-26)', 'pr (windows-2025)']
  const withChecks = (entries: any[]) => [
    {
      ...ruleset,
      target: 'branch' as const,
      rules: [
        {
          type: 'required_status_checks',
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: entries,
          },
        },
      ],
    },
  ]
  const entries = checks.map((context) => ({ context, integration_id: 15368 }))
  expect(() => assertRulesetChecks(withChecks(entries), checks)).not.toThrow()
  expect(() => assertRulesetChecks(withChecks(entries.slice(1)), checks)).toThrow('complete workflow matrix')
  expect(() => assertRulesetChecks(withChecks(entries.map((item) => ({ ...item, integration_id: 7 }))), checks)).toThrow('identity')
})
