import { expect, jest, test } from '@jest/globals'
import { parseConfig, readConfig } from '../src/parts/RepositoryConfig/RepositoryConfig.ts'
import { assertOwnership, planResources } from '../src/parts/RepositoryConfig/RepositoryResources.ts'

const permissions = { administration: 'write', issues: 'write', environments: 'write', members: 'read' }
const config = 'version: 1\nrequiredStatusChecks: [pr]\n'
const label = { name: 'managed', color: 'abcdef', description: 'managed label' }
const fixture = (initial: any[] = []) => {
  let live = [...initial]
  const updateLabel = jest.fn<(options: any) => Promise<any>>().mockImplementation(async (item) => {
    live = live.map((old) => (old.name === item.name ? { name: item.name, color: item.color, description: item.description } : old))
  })
  const createLabel = jest.fn<(options: any) => Promise<any>>().mockImplementation(async (item) => {
    live.push({ name: item.name, color: item.color, description: item.description })
  })
  const deleteLabel = jest.fn<(options: any) => Promise<any>>().mockImplementation(async (item) => {
    live = live.filter((old) => old.name !== item.name)
  })
  const octokit: any = {
    paginate: jest.fn<() => Promise<any>>().mockImplementation(async () => live),
    rest: { issues: { updateLabel, createLabel, deleteLabel } },
  }
  return { octokit, updateLabel, createLabel, deleteLabel, live: () => live }
}

test('parses YAML metadata, topics and collections', () => {
  expect(parseConfig(`${config}settings:\n  description: About View\n  has_issues: true\ntopics: [lvce-editor]\nlabels: []\n`)).toEqual({
    version: 1,
    requiredStatusChecks: ['pr'],
    settings: { description: 'About View', has_issues: true },
    topics: ['lvce-editor'],
    labels: [],
  })
})

test.each([
  'version: 1\nversion: 1\nrequiredStatusChecks: [pr]',
  `${config}topics: &topics [editor]\nlabels: *topics`,
  `${config}topics: [Editor]`,
  `${config}settings: {private: true}`,
  `${config}settings: {default_branch: other}`,
  `${config}settings: {description: true}`,
  `${config}labels: [{name: test, color: abcdef, description: text, oldname: old}]`,
  `${config}labels: [{name: test, color: abcdef, description: text}, {name: TEST, color: abcdef, description: text}]`,
  `${config}environments: [{name: prod}]`,
  `${config}collaborators: [{username: person, permission: superadmin}]`,
  `${config}teams: [{name: '../other', permission: admin}]`,
  `${config}labels: !!js/function function(){}`,
])('rejects malformed, ambiguous or unsupported data %s', (text) => {
  expect(() => parseConfig(text)).toThrow()
})

test('YAML migration accepts legacy base but rejects two config files', async () => {
  const getContent = jest.fn<(options: any) => Promise<any>>().mockImplementation(async ({ path }) => {
    if (path.endsWith('.yml')) throw Object.assign(new Error('missing'), { status: 404 })
    return { data: { type: 'file', encoding: 'base64', size: 50, content: Buffer.from(config).toString('base64') } }
  })
  const octokit: any = { rest: { repos: { getContent } } }
  expect(await readConfig(octokit, 'lvce-editor/about-view', 'main')).toEqual({ version: 1, requiredStatusChecks: ['pr'] })
  getContent.mockResolvedValue({ data: { type: 'file', encoding: 'base64', size: 50, content: Buffer.from(config).toString('base64') } })
  await expect(readConfig(octokit, 'lvce-editor/about-view', 'main')).rejects.toThrow('Remove legacy')
})

test('collection ownership is bootstrapped once, with additions and removals permitted afterward', () => {
  expect(() => assertOwnership({}, { labels: [] })).toThrow('Bootstrap')
  expect(() => assertOwnership({ labels: [] }, {})).toThrow('Bootstrap')
  expect(() => assertOwnership({ labels: [] }, { labels: [label] })).not.toThrow()
})

test('permission failures happen before reads and writes', async () => {
  const { octokit, createLabel } = fixture()
  await expect(planResources(octokit, 'lvce-editor', 'about-view', { labels: [] }, { labels: [label] }, { administration: 'write' })).rejects.toThrow(
    'issues: write',
  )
  expect(octokit.paginate).not.toHaveBeenCalled()
  expect(createLabel).not.toHaveBeenCalled()
})

test('adds, updates and removes managed labels without touching unmanaged labels; duplicates are no-ops', async () => {
  const unmanaged = { name: 'unmanaged', color: '123456', description: 'leave me' }
  const { octokit, createLabel, updateLabel, deleteLabel, live } = fixture([unmanaged])
  const run = async (base: any, desired: any) => {
    for (const write of await planResources(octokit, 'lvce-editor', 'about-view', base, desired, permissions)) await write()
  }
  await run({ labels: [] }, { labels: [label] })
  await run({ labels: [] }, { labels: [label] })
  expect(createLabel).toHaveBeenCalledTimes(1)
  const changed = { ...label, color: '123456' }
  await run({ labels: [label] }, { labels: [changed] })
  expect(updateLabel).toHaveBeenCalledTimes(1)
  await run({ labels: [changed] }, { labels: [] })
  await run({ labels: [changed] }, { labels: [] })
  expect(deleteLabel).toHaveBeenCalledTimes(1)
  expect(live()).toEqual([unmanaged])
})

test('preflights every resource conflict before allowing any administrative write', async () => {
  const { octokit, createLabel } = fixture([{ ...label, description: 'external change' }])
  await expect(
    planResources(octokit, 'lvce-editor', 'about-view', { labels: [label] }, { labels: [{ name: 'new', color: 'abcdef', description: '' }] }, permissions),
  ).rejects.toThrow('conflicts')
  expect(createLabel).not.toHaveBeenCalled()
})

test('retry after partial failure only writes remaining resources', async () => {
  const second = { ...label, name: 'second' }
  const { octokit, createLabel } = fixture()
  const original = createLabel.getMockImplementation()!
  createLabel.mockImplementationOnce(original).mockRejectedValueOnce(new Error('API unavailable'))
  const desired = { labels: [label, second] }
  const writes = await planResources(octokit, 'lvce-editor', 'about-view', { labels: [] }, desired, permissions)
  await writes[0]()
  await expect(writes[1]()).rejects.toThrow('API unavailable')
  for (const write of await planResources(octokit, 'lvce-editor', 'about-view', { labels: [] }, desired, permissions)) await write()
  expect(createLabel).toHaveBeenCalledTimes(3)
})

test('a successful HTTP response without effective change is not application success', async () => {
  const { octokit, createLabel } = fixture()
  createLabel.mockResolvedValue({})
  const writes = await planResources(octokit, 'lvce-editor', 'about-view', { labels: [] }, { labels: [label] }, permissions)
  await expect(writes[0]()).rejects.toThrow('not confirmed')
})

test('topics are an explicit complete set; ordering is irrelevant and conflicts reject', async () => {
  const replaceAllTopics = jest.fn<() => Promise<any>>()
  const getAllTopics = jest.fn<() => Promise<any>>().mockResolvedValue({ data: { names: ['editor', 'about'] } })
  const octokit: any = { rest: { repos: { getAllTopics, replaceAllTopics } } }
  expect(await planResources(octokit, 'lvce-editor', 'about-view', { topics: ['about', 'editor'] }, { topics: ['editor', 'about'] }, permissions)).toHaveLength(
    0,
  )
  const writes = await planResources(octokit, 'lvce-editor', 'about-view', { topics: ['about', 'editor'] }, { topics: ['editor'] }, permissions)
  getAllTopics.mockResolvedValue({ data: { names: ['editor'] } })
  await writes[0]()
  expect(replaceAllTopics).toHaveBeenCalledWith({ owner: 'lvce-editor', repo: 'about-view', names: ['editor'] })
  getAllTopics.mockResolvedValue({ data: { names: ['editor', 'about'] } })
  await expect(planResources(octokit, 'lvce-editor', 'about-view', { topics: [] }, { topics: ['editor'] }, permissions)).rejects.toThrow('conflicts')
})

test('milestones use their stable numeric API identity and include closed milestones', async () => {
  const before = { title: 'v1', description: '', state: 'open', due_on: null }
  const after = { ...before, state: 'closed' }
  const paginate = jest
    .fn<() => Promise<any>>()
    .mockResolvedValueOnce([{ ...before, number: 12 }])
    .mockResolvedValueOnce([{ ...after, number: 12 }])
  const updateMilestone = jest.fn<() => Promise<any>>().mockResolvedValue({})
  const octokit: any = { paginate, rest: { issues: { updateMilestone } } }
  const writes = await planResources(octokit, 'lvce-editor', 'about-view', { milestones: [before] }, { milestones: [after] }, permissions)
  await writes[0]()
  expect(updateMilestone).toHaveBeenCalledWith({ owner: 'lvce-editor', repo: 'about-view', milestone_number: 12, ...after })
  expect(paginate).toHaveBeenCalledWith('GET /repos/{owner}/{repo}/milestones', expect.objectContaining({ state: 'all' }))
})

test('environment API responses normalize reviewer identities and preserve unmanaged environments', async () => {
  const environment = { name: 'pilot', wait_timer: 0, reviewers: [{ type: 'User', id: 7 }], prevent_self_review: true, deployment_branch_policy: null }
  const response = {
    name: 'pilot',
    protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 7, login: 'person' } }], prevent_self_review: true }],
    deployment_branch_policy: null,
  }
  const createOrUpdateEnvironment = jest.fn<() => Promise<any>>().mockResolvedValue({})
  const octokit: any = {
    paginate: jest.fn<() => Promise<any>>().mockResolvedValue([response]).mockResolvedValueOnce([]),
    rest: { repos: { createOrUpdateEnvironment } },
  }
  const writes = await planResources(octokit, 'lvce-editor', 'about-view', { environments: [] }, { environments: [environment] }, permissions)
  await writes[0]()
  const { name, ...settings } = environment
  expect(createOrUpdateEnvironment).toHaveBeenCalledWith({ owner: 'lvce-editor', repo: 'about-view', environment_name: name, ...settings })
  expect(await planResources(octokit, 'lvce-editor', 'about-view', { environments: [] }, { environments: [environment] }, permissions)).toHaveLength(0)
})

test('pending collaborator invitations block before any changes', async () => {
  const octokit: any = { paginate: jest.fn<() => Promise<any>>().mockResolvedValue([{ id: 12 }]) }
  await expect(planResources(octokit, 'lvce-editor', 'about-view', { collaborators: [] }, { collaborators: [] }, permissions)).rejects.toThrow(
    'pending collaborator invitations',
  )
})

test('unaccepted new collaborator grants are rejected and effective permissions are verified', async () => {
  const item = { username: 'person', permission: 'push' }
  const addCollaborator = jest.fn<() => Promise<any>>().mockResolvedValue({})
  const paginate = jest.fn<() => Promise<any>>().mockResolvedValue([])
  const octokit: any = { paginate, rest: { repos: { addCollaborator } } }
  await expect(planResources(octokit, 'lvce-editor', 'about-view', { collaborators: [] }, { collaborators: [item] }, permissions)).rejects.toThrow(
    'accepted access',
  )
  paginate
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ login: 'person', role_name: 'write' }])
    .mockResolvedValueOnce([{ login: 'person', role_name: 'admin' }])
  const writes = await planResources(
    octokit,
    'lvce-editor',
    'about-view',
    { collaborators: [item] },
    { collaborators: [{ ...item, permission: 'admin' }] },
    permissions,
  )
  await writes[0]()
  expect(addCollaborator).toHaveBeenCalledWith({ owner: 'lvce-editor', repo: 'about-view', username: 'person', permission: 'admin' })
})

test('team grants require members permission and normalize API roles', async () => {
  const item = { name: 'core', permission: 'push' }
  const addOrUpdateRepoPermissionsInOrg = jest.fn<() => Promise<any>>().mockResolvedValue({})
  const paginate = jest
    .fn<() => Promise<any>>()
    .mockResolvedValueOnce([{ slug: 'core', permission: 'push' }])
    .mockResolvedValueOnce([{ slug: 'core', permission: 'admin' }])
  const octokit: any = { paginate, rest: { teams: { addOrUpdateRepoPermissionsInOrg } } }
  await expect(planResources(octokit, 'lvce-editor', 'about-view', { teams: [item] }, { teams: [item] }, { administration: 'write' })).rejects.toThrow(
    'members: read',
  )
  const writes = await planResources(octokit, 'lvce-editor', 'about-view', { teams: [item] }, { teams: [{ ...item, permission: 'admin' }] }, permissions)
  await writes[0]()
  expect(addOrUpdateRepoPermissionsInOrg).toHaveBeenCalledWith({
    org: 'lvce-editor',
    owner: 'lvce-editor',
    repo: 'about-view',
    team_slug: 'core',
    permission: 'admin',
  })
})

test('pull_requests write also authorizes labels and milestones without issues write', async () => {
  const { octokit } = fixture()
  const writes = await planResources(
    octokit,
    'lvce-editor',
    'about-view',
    { labels: [] },
    { labels: [label] },
    { administration: 'write', pull_requests: 'write' },
  )
  expect(writes).toHaveLength(1)
  await writes[0]()
})
