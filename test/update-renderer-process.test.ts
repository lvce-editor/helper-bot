import * as nock from 'nock'
import { Probot, ProbotOctokit } from 'probot'
import * as myProbotApp from '../src/index.js'

let probot: Probot | undefined

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
  probot.load(myProbotApp)
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
  probot = undefined
})

jest.mock('execa', () => {
  return {
    execa: jest.fn(),
  }
})

jest.mock('node:fs/promises', () => {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  }
})

jest.mock('node:os', () => {
  return {
    tmpdir() {
      return '/test'
    },
  }
})

const { execa } = require('execa')
const fs = require('node:fs/promises')

test('creates a pull request to update versions when a release is created', async () => {
  const mock = nock('https://api.github.com')
    .get('/repos/lvce-editor/lvce-editor/git/ref/heads%2Fmain')
    .reply(200, {
      object: {
        sha: 'main-sha',
      },
    })
    .post('/repos/lvce-editor/lvce-editor/git/refs', (body) => {
      expect(body).toEqual({
        ref: 'refs/heads/update-version/language-basics-css-v2.4.0',
        sha: 'main-sha',
      })
      return true
    })
    .reply(200, {})
    .get(
      '/repos/lvce-editor/lvce-editor/contents/packages%2Fbuild%2Fsrc%2Fparts%2FDownloadBuiltinExtensions%2FbuiltinExtensions.json',
    )
    .reply(200, {
      content: Buffer.from(
        JSON.stringify([
          {
            name: 'builtin.language-basics-css',
            version: '2.3.0',
          },
        ]),
      ),
    })
    .put(
      '/repos/lvce-editor/lvce-editor/contents/packages%2Fbuild%2Fsrc%2Fparts%2FDownloadBuiltinExtensions%2FbuiltinExtensions.json',
      (body) => {
        expect(body).toEqual({
          branch: 'update-version/language-basics-css-v2.4.0',
          content:
            'WwogIHsKICAgICJuYW1lIjogImJ1aWx0aW4ubGFuZ3VhZ2UtYmFzaWNzLWNzcyIsCiAgICAidmVyc2lvbiI6ICIyLjQuMCIKICB9Cl0K',
          message: 'feature: update language-basics-css to version v2.4.0',
        })
        return true
      },
    )
    .reply(200)
    .post(`/repos/lvce-editor/lvce-editor/pulls`, (body) => {
      expect(body).toEqual({
        base: 'main',
        head: 'update-version/language-basics-css-v2.4.0',
        title: 'feature: update language-basics-css to version v2.4.0',
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
        name: 'language-basics-css',
        // @ts-ignore
        owner: {
          login: 'lvce-editor',
        },
      },
    },
  })
  expect(mock.pendingMocks()).toEqual([])
})

test("doesn't create a pull request when the new file content would be the same", async () => {
  const mock = nock('https://api.github.com')
    .get(
      '/repos/lvce-editor/lvce-editor/contents/packages%2Fbuild%2Fsrc%2Fparts%2FDownloadBuiltinExtensions%2FbuiltinExtensions.json',
    )
    .reply(200, {
      content: Buffer.from(
        JSON.stringify(
          [
            {
              name: 'builtin.language-basics-css',
              version: '2.4.0',
            },
          ],
          null,
          2,
        ) + '\n',
      ),
    })

  // Receive a webhook event
  await probot.receive({
    name: 'release',
    payload: {
      action: 'released',
      release: {
        tag_name: 'v2.4.0',
      },
      repository: {
        name: 'language-basics-css',
        // @ts-ignore
        owner: {
          login: 'lvce-editor',
        },
      },
    },
  })
  expect(mock.pendingMocks()).toEqual([])
})

test.only('creates a pull request to update renderer process version when a release is created', async () => {
  let latestPackageLockContent = ''
  jest.spyOn(fs, 'readFile').mockImplementation((path) => {
    if (typeof path === 'string' && path.endsWith('package-lock.json')) {
      return latestPackageLockContent
    }
    return ''
  })
  jest.spyOn(fs, 'writeFile').mockImplementation((path, content) => {
    if (
      typeof path === 'string' &&
      typeof content === 'string' &&
      path.endsWith('package-lock.json')
    ) {
      latestPackageLockContent = content
    }
  })
  const mock = nock('https://api.github.com')
    .get('/repos/lvce-editor/lvce-editor/git/ref/heads%2Fmain')
    .reply(200, {
      object: {
        sha: 'main-sha',
      },
    })
    .post('/repos/lvce-editor/lvce-editor/git/refs', (body) => {
      expect(body).toEqual({
        ref: 'refs/heads/update-version/renderer-process-v2.4.0',
        sha: 'main-sha',
      })
      return true
    })
    .reply(200, {})
    .get(
      '/repos/lvce-editor/lvce-editor/contents/packages%2Frenderer-worker%2Fpackage.json',
    )
    .reply(200, {
      content: Buffer.from(
        JSON.stringify({
          name: 'renderer-worker',
          dependencies: {
            '@lvce-editor/renderer-process': '^2.2.0',
          },
        }),
      ).toString('base64'),
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
          packages: {},
        }),
      ).toString('base64'),
    })
    .post(`/repos/lvce-editor/lvce-editor/pulls`, (body) => {
      expect(body).toEqual({
        base: 'main',
        head: 'update-version/language-basics-css-v2.4.0',
        title: 'feature: update language-basics-css to version v2.4.0',
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
})