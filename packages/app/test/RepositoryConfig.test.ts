import { expect, jest, test } from '@jest/globals'
import { applyRequest, getWorkflowChecks, isTrustedAuthor, parseConfig, validateRequest } from '../src/parts/RepositoryConfig/RepositoryConfig.ts'
import { requestFromRunName } from '../src/parts/RepositoryConfig/HandleRepositoryConfig.ts'

const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const request = { repository: 'lvce-editor/about-view', pullRequest: 12, headSha, baseSha }
const platforms = ['ubuntu-24.04', 'ubuntu-24.04-arm', 'macos-26', 'windows-2025']
const desired = { version: 1, requiredStatusChecks: platforms.map((os) => `pr (${os})`) }
const base = { ...desired, requiredStatusChecks: desired.requiredStatusChecks.map((name) => name.replace('macos-26', 'macos-15')) }
const workflow = (os: readonly string[]) =>
  `on: pull_request\njobs:\n  pr:\n    strategy:\n      matrix:\n        os: ${JSON.stringify(os)}\n    runs-on: \u0024{{ matrix.os }}\n`

const fixture = () => {
  const pr = {
    state: 'open',
    draft: false,
    user: { login: 'levivilet', id: 72156503 },
    base: { ref: 'main', sha: baseSha, repo: { full_name: request.repository } },
    head: { sha: headSha, repo: { full_name: request.repository } },
  }
  const runs = [
    {
      id: 42,
      path: '.github/workflows/pr.yml',
      head_sha: headSha,
      status: 'completed',
      conclusion: 'success',
      run_attempt: 2,
      pull_requests: [{ number: 12, base: { sha: baseSha } }],
    },
  ]
  const jobs = desired.requiredStatusChecks.map((name) => ({ name, status: 'completed', conclusion: 'success' }))
  const getContent = jest.fn<(options: any) => Promise<any>>().mockImplementation(async ({ path, ref }) => {
    if (path === '.github/workflows') {
      return { data: [{ name: 'pr.yml', path: '.github/workflows/pr.yml' }] }
    }
    const text = path.endsWith('.json')
      ? JSON.stringify(ref === headSha ? desired : base)
      : workflow(ref === headSha ? platforms : platforms.map((os) => os.replace('macos-26', 'macos-15')))
    return { data: { type: 'file', encoding: 'base64', size: text.length, content: Buffer.from(text).toString('base64') } }
  })
  const listRuns = jest.fn()
  const listJobs = jest.fn()
  const octokit: any = {
    rest: {
      pulls: { get: jest.fn<() => Promise<any>>().mockResolvedValue({ data: pr }) },
      git: {
        getRef: jest.fn<() => Promise<any>>().mockResolvedValue({ data: { object: { sha: baseSha } } }),
        createRef: jest.fn<() => Promise<any>>().mockResolvedValue({}),
        deleteRef: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      },
      checks: { listForRef: jest.fn() },
      repos: {
        listCommitStatusesForRef: jest.fn(),
        getContent,
        get: jest.fn<() => Promise<any>>().mockResolvedValue({ data: {} }),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({}),
        getStatusChecksProtection: jest.fn<() => Promise<any>>().mockResolvedValue({
          data: { contexts: base.requiredStatusChecks, checks: base.requiredStatusChecks.map((context) => ({ context, app_id: 15368 })), strict: true },
        }),
        updateStatusCheckProtection: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      },
      actions: { listWorkflowRunsForRepo: listRuns, listJobsForWorkflowRunAttempt: listJobs },
    },
    paginate: jest
      .fn<(method: any, params: any) => Promise<any>>()
      .mockImplementation(async (method) => (method === listRuns ? runs : method === listJobs ? jobs : [])),
  }
  return { octokit, pr, runs, jobs, getContent }
}

test('trust requires the login and immutable identity as a pair', () => {
  expect(isTrustedAuthor({ login: 'levivilet', id: 72156503 })).toBe(true)
  expect(isTrustedAuthor({ login: 'lvce-editor-helper-bot[bot]', id: 155071229 })).toBe(true)
  expect(isTrustedAuthor({ login: 'levivilet', id: 155071229 })).toBe(false)
  expect(isTrustedAuthor({ login: 'attacker', id: 72156503 })).toBe(false)
})

test.each([
  { ...desired, version: 2 },
  { ...desired, settings: { admin: true } },
  { ...desired, rulesetId: -1 },
  { ...desired, requiredStatusChecks: [] },
  { ...desired, bypass_actors: [] },
  { ...desired, requiredStatusChecks: ['pr', 'pr'] },
])('rejects invalid configuration: %j', (value) => {
  expect(() => parseConfig(JSON.stringify(value))).toThrow()
})

test('requires static complete matrices and rejects conditional jobs', () => {
  expect(getWorkflowChecks(workflow(platforms))).toEqual(desired.requiredStatusChecks)
  expect(() => getWorkflowChecks('on: pull_request\njobs:\n  test:\n    if: false\n')).toThrow()
  expect(() => getWorkflowChecks('on: pull_request\njobs:\n  test:\n    strategy:\n      matrix: ${{ fromJSON(needs.setup.outputs.matrix) }}\n')).toThrow()
})

test('validates the complete matrix against the exact head and main revision', async () => {
  const { octokit } = fixture()
  expect(await validateRequest(octokit, request)).toEqual({ base, desired, changed: true })
  expect(octokit.paginate).toHaveBeenCalledWith(octokit.rest.actions.listJobsForWorkflowRunAttempt, expect.objectContaining({ run_id: 42, attempt_number: 2 }))
})

test.each(['author', 'head', 'base', 'fork', 'closed'])('rejects %s before reading configuration', async (kind) => {
  const { octokit, pr, getContent } = fixture()
  if (kind === 'author') pr.user.id = 9
  if (kind === 'head') pr.head.sha = 'c'.repeat(40)
  if (kind === 'base') pr.base.sha = 'c'.repeat(40)
  if (kind === 'fork') pr.head.repo.full_name = 'attacker/about-view'
  if (kind === 'closed') pr.state = 'closed'
  await expect(validateRequest(octokit, request)).rejects.toThrow('Untrusted, closed or stale')
  expect(getContent).not.toHaveBeenCalled()
})

test.each(['pending', 'failed', 'missing', 'skipped', 'stale-base'])('rejects %s CI evidence', async (kind) => {
  const { octokit, runs, jobs } = fixture()
  if (kind === 'pending') runs[0].status = 'in_progress'
  if (kind === 'failed') runs[0].conclusion = 'failure'
  if (kind === 'missing') jobs.pop()
  if (kind === 'skipped') jobs[0].conclusion = 'skipped'
  if (kind === 'stale-base') runs[0].pull_requests[0].base.sha = 'c'.repeat(40)
  await expect(validateRequest(octokit, request)).rejects.toThrow()
})

test('updates only required checks and preserves strict protection', async () => {
  const { octokit } = fixture()
  await applyRequest(octokit, request)
  expect(octokit.rest.repos.updateStatusCheckProtection).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'about-view',
    branch: 'main',
    strict: true,
    checks: desired.requiredStatusChecks.map((context) => ({ context, app_id: 15368 })),
  })
  expect(octokit.rest.git.deleteRef).toHaveBeenCalledTimes(1)
})

test('duplicate application makes no administrative writes', async () => {
  const { octokit } = fixture()
  octokit.rest.repos.getStatusChecksProtection.mockResolvedValue({
    data: { contexts: desired.requiredStatusChecks, checks: desired.requiredStatusChecks.map((context) => ({ context, app_id: 15368 })), strict: true },
  })
  await applyRequest(octokit, request)
  expect(octokit.rest.repos.updateStatusCheckProtection).not.toHaveBeenCalled()
  expect(octokit.rest.repos.update).not.toHaveBeenCalled()
})

test('a conflicting PR cannot overwrite live settings', async () => {
  const { octokit } = fixture()
  octokit.rest.repos.getStatusChecksProtection.mockResolvedValue({ data: { contexts: ['different'], checks: [{ context: 'different', app_id: 15368 }] } })
  await expect(applyRequest(octokit, request)).rejects.toThrow('conflict')
  expect(octokit.rest.repos.updateStatusCheckProtection).not.toHaveBeenCalled()
  expect(octokit.rest.git.deleteRef).toHaveBeenCalledTimes(1)
})

test('a held distributed lock prevents overlapping application and is not deleted', async () => {
  const { octokit } = fixture()
  octokit.rest.git.createRef.mockRejectedValue(new Error('Reference already exists'))
  await expect(applyRequest(octokit, request)).rejects.toThrow('Reference already exists')
  expect(octokit.rest.git.deleteRef).not.toHaveBeenCalled()
  expect(octokit.rest.repos.updateStatusCheckProtection).not.toHaveBeenCalled()
})

test('write failures are propagated and the lock is released', async () => {
  const { octokit } = fixture()
  octokit.rest.repos.updateStatusCheckProtection.mockRejectedValue(new Error('Permission denied'))
  await expect(applyRequest(octokit, request)).rejects.toThrow('Permission denied')
  expect(octokit.rest.git.deleteRef).toHaveBeenCalledTimes(1)
})

test('rejects a branch update immediately before the administrative write', async () => {
  const { octokit, pr } = fixture()
  octokit.rest.pulls.get
    .mockResolvedValueOnce({ data: pr })
    .mockResolvedValueOnce({ data: pr })
    .mockResolvedValueOnce({ data: { ...pr, head: { ...pr.head, sha: 'c'.repeat(40) } } })
  await expect(applyRequest(octokit, request)).rejects.toThrow('stale')
  expect(octokit.rest.repos.updateStatusCheckProtection).not.toHaveBeenCalled()
})

test('workflow request identity cannot redirect to another owner or revision', () => {
  expect(requestFromRunName(`repository-config/${request.repository}/12/${headSha}/${baseSha}`)).toEqual(request)
  expect(() => requestFromRunName(`repository-config/microsoft/vscode/12/${headSha}/${baseSha}`)).toThrow()
  expect(() => requestFromRunName('repository-config/lvce-editor/about-view/12/main/main')).toThrow()
})

test('rejects pending external checks and failed commit statuses', async () => {
  const { octokit } = fixture()
  const original = octokit.paginate.getMockImplementation()
  octokit.paginate.mockImplementation(async (method: any, params: any) => {
    if (method === octokit.rest.checks.listForRef) return [{ head_sha: headSha, status: 'in_progress', conclusion: null }]
    return original(method, params)
  })
  await expect(validateRequest(octokit, request)).rejects.toThrow('unsuccessful check runs')
  octokit.paginate.mockImplementation(async (method: any, params: any) => {
    if (method === octokit.rest.repos.listCommitStatusesForRef) return [{ context: 'external', state: 'failure' }]
    return original(method, params)
  })
  await expect(validateRequest(octokit, request)).rejects.toThrow('failed commit statuses')
})

test('preserves unrelated rules, conditions and bypass actors when updating a repository ruleset', async () => {
  const { octokit, getContent } = fixture()
  const original = getContent.getMockImplementation()!
  getContent.mockImplementation(async (options: any) => {
    const response = await original(options)
    if (options.path.endsWith('.json')) {
      const value = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'))
      response.data.content = Buffer.from(JSON.stringify({ ...value, rulesetId: 99 })).toString('base64')
    }
    return response
  })
  const unchangedRule = { type: 'deletion' }
  const conditions = { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } }
  const actors = [{ actor_id: 7, actor_type: 'Integration', bypass_mode: 'pull_request' }]
  const live = {
    id: 99,
    source_type: 'Repository',
    source: request.repository,
    target: 'branch',
    enforcement: 'active',
    name: 'Protect main',
    conditions,
    bypass_actors: actors,
    rules: [
      unchangedRule,
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: base.requiredStatusChecks.map((context) => ({ context, integration_id: 15368 })),
        },
      },
    ],
  }
  octokit.request = jest.fn<(route: string, options: any) => Promise<any>>().mockResolvedValue({ data: live })
  await applyRequest(octokit, request)
  expect(octokit.request).toHaveBeenLastCalledWith(
    'PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}',
    expect.objectContaining({
      ruleset_id: 99,
      conditions,
      bypass_actors: actors,
      rules: [
        unchangedRule,
        {
          type: 'required_status_checks',
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: desired.requiredStatusChecks.map((context) => ({ context, integration_id: 15368 })),
          },
        },
      ],
    }),
  )
  expect(octokit.rest.repos.updateStatusCheckProtection).not.toHaveBeenCalled()
})

test('rejects inherited organization rulesets', async () => {
  const { octokit, getContent } = fixture()
  const original = getContent.getMockImplementation()!
  getContent.mockImplementation(async (options: any) => {
    const response = await original(options)
    if (options.path.endsWith('.json')) {
      const value = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'))
      response.data.content = Buffer.from(JSON.stringify({ ...value, rulesetId: 99 })).toString('base64')
    }
    return response
  })
  octokit.request = jest.fn<() => Promise<any>>().mockResolvedValue({ data: { source_type: 'Organization', source: 'lvce-editor' } })
  await expect(applyRequest(octokit, request)).rejects.toThrow('repository-owned')
  expect(octokit.request).toHaveBeenCalledTimes(1)
})
