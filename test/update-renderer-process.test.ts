import nock from 'nock'
import { Probot, ProbotOctokit } from 'probot'
import { join } from 'path'
import { jest, beforeEach, test, expect, afterEach } from '@jest/globals'

let probot: Probot | undefined

jest.unstable_mockModule('execa', () => {
  return {
    execa: jest.fn(),
  }
})

jest.unstable_mockModule('node:fs/promises', () => {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    rm: jest.fn(),
    readdir: jest.fn(),
  }
})

jest.unstable_mockModule('node:os', () => {
  return {
    tmpdir() {
      return '/test'
    },
    hostname() {
      return 'localhost'
    },
    availableParallelism() {
      return 1
    },
  }
})

const myProbotApp = await import('../src/index.js')
const execa = await import('execa')
const fs = await import('node:fs/promises')

beforeEach(() => {
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
  probot.load(myProbotApp.default || myProbotApp)
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
  probot = undefined
})

test('creates a pull request to update versions when a release is created', async () => {
  let packageLockContent = ''
  // @ts-ignore
  jest.spyOn(fs, 'readFile').mockImplementation((path) => {
    if (typeof path === 'string' && path.endsWith('package-lock.json')) {
      return packageLockContent
    }
    return ''
  })
  // @ts-ignore
  jest.spyOn(fs, 'writeFile').mockImplementation((path, content) => {
    if (
      typeof path === 'string' &&
      path.endsWith('package-lock.json') &&
      typeof content === 'string'
    ) {
      packageLockContent = content
    }
  })
  // @ts-ignore
  jest.spyOn(execa, 'execa').mockImplementation(() => {
    packageLockContent = JSON.stringify({
      name: '@lvce-editor/renderer-worker',
      version: '0.0.0-dev',
      lockfileVersion: 3,
      requires: true,
      updated: true,
    })
  })
  // @ts-ignore
  jest.spyOn(fs, 'rm').mockImplementation(() => {})
  const mock = nock('https://api.github.com')
    .get('/repos/lvce-editor/lvce-editor/git/ref/heads%2Fmain')
    .reply(200, {
      object: {
        sha: 'main-sha',
      },
    })
    .get('/repos/lvce-editor/lvce-editor/git/commits/main-sha')
    .reply(200, {
      sha: 'starting-commit-sha',
    })
    .get(
      '/repos/lvce-editor/lvce-editor/contents/packages%2Frenderer-worker%2Fpackage.json',
    )
    .reply(200, {
      content: Buffer.from(
        JSON.stringify({
          name: 'renderer-worker',
          dependencies: {
            '@lvce-editor/renderer-process': '^2.3.0',
          },
        }),
      ),
    })
    .get(
      '/repos/lvce-editor/lvce-editor/contents/packages%2Frenderer-worker%2Fpackage-lock.json',
    )
    .reply(200, {
      content: Buffer.from(
        JSON.stringify({
          name: '@lvce-editor/renderer-worker',
          version: '0.0.0-dev',
          lockfileVersion: 3,
          requires: true,
        }),
      ),
    })
    .post('/repos/lvce-editor/lvce-editor/git/trees', (body) => {
      expect(body).toEqual({
        base_tree: 'starting-commit-sha',
        tree: [
          {
            content:
              JSON.stringify(
                {
                  name: 'renderer-worker',
                  dependencies: {
                    '@lvce-editor/renderer-process': '^2.4.0',
                  },
                },
                null,
                2,
              ) + '\n',
            mode: '100644',
            path: 'packages/renderer-worker/package.json',
            type: 'blob',
          },
          {
            content: JSON.stringify({
              name: '@lvce-editor/renderer-worker',
              version: '0.0.0-dev',
              lockfileVersion: 3,
              requires: true,
              updated: true,
            }),
            mode: '100644',
            path: 'packages/renderer-worker/package-lock.json',
            type: 'blob',
          },
        ],
      })
      return true
    })
    .reply(201, {
      object: {
        sha: 'new-commit-sha',
      },
    })
    .post('/repos/lvce-editor/lvce-editor/git/commits', (body) => {
      expect(body).toEqual({
        message: 'feature: update renderer-process to version v2.4.0',
        parents: ['starting-commit-sha'],
      })
      return true
    })
    .reply(201, {
      sha: 'new-commit-sha',
    })
    .post('/repos/lvce-editor/lvce-editor/git/refs', (body) => {
      expect(body).toEqual({
        ref: 'refs/heads/update-version/renderer-process-v2.4.0',
        sha: 'new-commit-sha',
      })
      return true
    })
    .reply(201, {
      object: {
        sha: 'new-commit-sha',
      },
    })
    .post(`/repos/lvce-editor/lvce-editor/pulls`, (body) => {
      expect(body).toEqual({
        base: 'main',
        head: 'update-version/renderer-process-v2.4.0',
        title: 'feature: update renderer-process to version v2.4.0',
      })
      return true
    })
    .reply(200, {
      node_id: 'test-node-id',
    })
    .post('/graphql', (body) => {
      expect(body).toEqual({
        query: `mutation MyMutation {
  enablePullRequestAutoMerge(input: { pullRequestId: \"test-node-id\", mergeMethod: SQUASH }) {
    clientMutationId
  }
}
`,
      })
      return true
    })
    .reply(200)

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
  expect(mock.pendingMocks()).toEqual([])
  expect(fs.rm).toHaveBeenCalledTimes(2)
  const testPath = join(
    '/test',
    'update-dependencies-renderer-worker-renderer-process-2.4.0-tmp',
  )
  const testCachePath = join(
    '/test',
    'update-dependencies-renderer-worker-renderer-process-2.4.0-tmp-cache',
  )
  expect(fs.rm).toHaveBeenNthCalledWith(1, testPath, {
    force: true,
    recursive: true,
  })
  expect(fs.rm).toHaveBeenNthCalledWith(2, testCachePath, {
    force: true,
    recursive: true,
  })
})
