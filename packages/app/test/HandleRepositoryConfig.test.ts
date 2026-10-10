import { expect, jest, test } from '@jest/globals'
import { createHandleConfigApplicationCompleted } from '../src/parts/RepositoryConfig/HandleRepositoryConfig.ts'
import { WORKFLOW_PATH } from '../src/parts/RepositoryConfig/RepositoryConfig.ts'

const sha = 'a'.repeat(40)
const base = 'b'.repeat(40)
const validRun = {
  id: 42,
  path: WORKFLOW_PATH,
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_sha: sha,
  status: 'completed',
  conclusion: 'success',
  actor: { login: 'levivilet', id: 72156503 },
  display_title: `repository-config/lvce-editor/about-view/12/${sha}/${base}`,
}
const fixture = () => {
  const getWorkflowRun = jest.fn<() => Promise<any>>().mockResolvedValue({ data: validRun })
  const context: any = {
    payload: { repository: { full_name: 'lvce-editor/helper-bot' }, workflow_run: validRun },
    octokit: { rest: { actions: { getWorkflowRun }, git: { getRef: jest.fn<() => Promise<any>>().mockResolvedValue({ data: { object: { sha } } }) } } },
    log: { warn: jest.fn(), error: jest.fn() },
  }
  const app: any = { auth: jest.fn() }
  return { context, app, getWorkflowRun }
}

test.each([
  { event: 'pull_request' },
  { head_branch: 'feature/malicious' },
  { head_sha: base },
  { path: '.github/workflows/untrusted.yml' },
  { actor: { login: 'levivilet', id: 9 } },
  { status: 'in_progress' },
])('rejects untrusted workflow execution %j before obtaining administrative credentials', async (override) => {
  const { context, app, getWorkflowRun } = fixture()
  getWorkflowRun.mockResolvedValue({ data: { ...validRun, ...override } })
  await expect(createHandleConfigApplicationCompleted(app)(context)).rejects.toThrow('Untrusted or stale')
  expect(app.auth).not.toHaveBeenCalled()
})

test('does not treat failed validation as successful application', async () => {
  const { context, app, getWorkflowRun } = fixture()
  getWorkflowRun.mockResolvedValue({ data: { ...validRun, conclusion: 'failure' } })
  const createComment = jest.fn<() => Promise<any>>().mockResolvedValue({})
  const createRef = jest.fn()
  app.auth
    .mockResolvedValueOnce({ rest: { apps: { getRepoInstallation: jest.fn<() => Promise<any>>().mockResolvedValue({ data: { id: 1 } }) } } })
    .mockResolvedValueOnce({ rest: { issues: { createComment }, git: { createRef } } })
  await expect(createHandleConfigApplicationCompleted(app)(context)).rejects.toThrow('validation workflow failed')
  expect(createRef).not.toHaveBeenCalled()
  expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('not confirmed applied') }))
})
