import nock from 'nock'
import { Probot, ProbotOctokit } from 'probot'
import { beforeEach, test, expect, afterEach } from '@jest/globals'

let probot: Probot | undefined

const myProbotApp = await import('../src/index.ts')

beforeEach(async () => {
  nock.disableNetConnect()
  probot = new Probot({
    appId: 123,
    privateKey: '123',
    // disable request throttling and retries for testing
    Octokit: ProbotOctokit.defaults({
      retry: { enabled: false },
      throttle: { enabled: false },
    }),
  })
  // @ts-ignore
  await probot.load(myProbotApp.default || myProbotApp)
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
  probot = undefined
})

test('creates a pull request to update versions when a release is created', async () => {
  const workflowDispatchBodies: any[] = []
  const mock = nock('https://api.github.com')
    .get('/repos/lvce-editor/helper-bot/installation')
    .reply(200, {
      id: 44,
    })
    .post('/app/installations/44/access_tokens')
    .reply(200, {
      expires_at: '2026-05-20T00:00:00Z',
      permissions: {},
      repository_selection: 'selected',
      token: 'installation-token',
    })
    .post('/repos/lvce-editor/helper-bot/actions/workflows/run-migration-on-demand.yml/dispatches', (body) => {
      workflowDispatchBodies.push(body)
      return true
    })
    .reply(204)

  // Receive a webhook event
  await probot.receive({
    name: 'release',
    payload: {
      action: 'released',
      release: {
        tag_name: 'v2.4.0',
      },
      repository: {
        name: 'renderer-process',
        // @ts-ignore
        owner: {
          login: 'lvce-editor',
        },
      },
    },
  })
  expect(workflowDispatchBodies).toEqual([
    {
      inputs: {
        baseBranch: 'main',
        migrationId: '/migrations2/update-specific-dependency',
        migrationOptionsJson: '{"fromRepo":"renderer-process","tagName":"v2.4.0","toFolder":"packages/renderer-worker","toRepo":"lvce-editor"}',
        requestId: expect.any(String),
        runName: 'migration-on-demand/lvce-editor/update-specific-dependency',
        targetRepository: 'lvce-editor/lvce-editor',
      },
      ref: 'main',
    },
  ])
  expect(mock.pendingMocks()).toEqual([])
})
