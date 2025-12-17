import { expect, jest, test } from '@jest/globals'

const mockExeca = {
  execa: jest.fn(),
}

const mockFs = {
  mkdir: jest.fn(),
  rm: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  writeFile: jest.fn(),
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
  chmod: jest.fn(),
}

const mockSentry = {}

jest.unstable_mockModule('execa', () => mockExeca)
jest.unstable_mockModule('@sentry/node', () => mockSentry)
jest.unstable_mockModule('node:fs/promises', () => mockFs)
jest.unstable_mockModule('node:fs', () => mockFs)
jest.unstable_mockModule('node:os', () => ({
  tmpdir: () => '/test',
}))

const { handleDependencies } = await import('../src/dependencies.js')

test('verifies secret correctly', async () => {
  const handler = handleDependencies({
    app: {} as any,
    secret: 'test-secret',
    installationId: 1,
  })
  const mockReq = {
    query: {
      secret: 'wrong-secret',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
  await handler(mockReq as any, mockRes as any)
  expect(mockRes.status).toHaveBeenCalledWith(401)
  expect(mockRes.send).toHaveBeenCalledWith('Unauthorized')
})

test('handles missing repository name', async () => {
  const mockOctoKit = {}
  const app = {
    auth() {
      return mockOctoKit
    },
  }
  const handler = handleDependencies({
    app: app as any,
    installationId: 1,
    secret: 'test-secret',
  })
  const mockReq = {
    query: {
      secret: 'test-secret',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
  await handler(mockReq as any, mockRes as any)
  expect(mockRes.status).toHaveBeenCalledWith(400)
  expect(mockRes.send).toHaveBeenCalledWith('Missing repositoryName parameter')
})

test('creates pull request successfully', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        // @ts-ignore
        get: jest.fn().mockResolvedValue({}),
      },
      git: {
        // @ts-ignore
        getRef: jest.fn().mockResolvedValue({
          data: { object: { sha: 'main-sha' } },
        }),
        // @ts-ignore
        getCommit: jest.fn().mockResolvedValue({
          data: { sha: 'commit-sha' },
        }),
        // @ts-ignore
        createTree: jest.fn().mockResolvedValue({
          data: { sha: 'tree-sha' },
        }),
        // @ts-ignore
        createCommit: jest.fn().mockResolvedValue({
          data: { sha: 'new-commit-sha' },
        }),
        // @ts-ignore
        createRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        // @ts-ignore
        create: jest.fn().mockResolvedValue({ data: { node_id: 'test-id' } }),
      },
      // @ts-ignore
      graphql: jest.fn().mockResolvedValue({}),
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const app = {
    auth() {
      return mockOctokit
    },
  }

  const handler = handleDependencies({
    app: app as any,
    installationId: 1,
    secret: 'test-secret',
  })

  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'lvce-editor/repo',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn(),
  }

  // @ts-ignore
  mockExeca.execa.mockImplementation(async (cmd, args) => {
    // @ts-ignore
    if (cmd === 'git' && args[0] === 'status') {
      return { stdout: 'M  package.json' }
    }
    return { stdout: '' }
  })
  // @ts-ignore
  mockFs.readFile.mockResolvedValue('test content')
  // @ts-ignore
  mockFs.mkdir.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  mockFs.existsSync.mockReturnValue(true)

  await handler(mockReq as any, mockRes as any)

  expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'repo',
    tree: [
      {
        path: 'package.json',
        mode: '100644',
        type: 'blob',
        content: 'test content',
      },
    ],
    base_tree: 'commit-sha',
  })

  expect(mockOctokit.rest.git.createCommit).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'repo',
    message: 'update dependencies',
    tree: 'tree-sha',
    parents: ['commit-sha'],
  })

  expect(mockRes.status).toHaveBeenCalledWith(200)
  expect(mockRes.send).toHaveBeenCalledWith('Dependencies update PR created successfully')
})

test('handles no changes case', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        // @ts-ignore
        get: jest.fn().mockResolvedValue({}),
      },
    },
  }

  const app = {
    auth() {
      return mockOctokit
    },
  }

  const handler = handleDependencies({
    app: app as any,
    installationId: 1,
    secret: 'test-secret',
  })

  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'lvce-editor/repo',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({ stdout: '' })
  // @ts-ignore
  mockFs.mkdir.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  await handler(mockReq as any, mockRes as any)

  expect(mockRes.status).toHaveBeenCalledWith(200)
  expect(mockRes.send).toHaveBeenCalledWith('No changes to commit')
})

test('handles repository not found', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        // @ts-ignore
        get: jest.fn().mockRejectedValue({ status: 404 }),
      },
    },
  }
  const app = {
    auth() {
      return mockOctokit
    },
  }

  const handler = handleDependencies({
    app: app as any,
    installationId: 1,

    secret: 'test-secret',
  })

  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'lvce-editor/repo',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }

  await handler(mockReq as any, mockRes as any)

  expect(mockRes.status).toHaveBeenCalledWith(404)
  expect(mockRes.send).toHaveBeenCalledWith('Repository not found')
})

test('handles invalid repository owner', async () => {
  const mockOctoKit = {}
  const app = {
    auth() {
      return mockOctoKit
    },
  }
  const handler = handleDependencies({
    app: app as any,
    installationId: 1,
    secret: 'test-secret',
  })
  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'wrong-owner/repo',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
  await handler(mockReq as any, mockRes as any)
  expect(mockRes.status).toHaveBeenCalledWith(400)
  expect(mockRes.send).toHaveBeenCalledWith('Repository owner must be lvce-editor')
})

test('updates existing pull request when one exists', async () => {
  // Set the environment variable for the test
  const originalBotUserId = process.env.BOT_USER_ID
  process.env.BOT_USER_ID = '23086823'

  // Mock console.warn to avoid noise in test output
  const originalWarn = console.warn
  console.warn = jest.fn()

  const mockOctokit = {
    rest: {
      repos: {
        // @ts-ignore
        get: jest.fn().mockResolvedValue({}),
      },
      git: {
        // @ts-ignore
        getRef: jest.fn().mockResolvedValue({
          data: { object: { sha: 'main-sha' } },
        }),
        // @ts-ignore
        getCommit: jest.fn().mockResolvedValue({
          data: { sha: 'commit-sha' },
        }),
        // @ts-ignore
        createTree: jest.fn().mockResolvedValue({
          data: { sha: 'tree-sha' },
        }),
        // @ts-ignore
        createCommit: jest.fn().mockResolvedValue({
          data: { sha: 'new-commit-sha' },
        }),
        // @ts-ignore
        updateRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        // @ts-ignore
        list: jest.fn().mockResolvedValue({
          data: [
            {
              title: 'update dependencies',
              user: { login: 'helper-bot[bot]', id: 23086823, type: 'Bot' },
              head: { ref: 'update-dependencies-1234567890' },
            },
          ],
        }),
      },
      // @ts-ignore
      graphql: jest.fn().mockResolvedValue({}),
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const app = {
    auth() {
      return mockOctokit
    },
  }

  const handler = handleDependencies({
    app: app as any,
    installationId: 1,
    secret: 'test-secret',
  })

  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'lvce-editor/repo',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn(),
  }

  // @ts-ignore
  mockExeca.execa.mockImplementation(async (cmd, args) => {
    // @ts-ignore
    if (cmd === 'git' && args[0] === 'status') {
      return { stdout: 'M  package.json' }
    }
    return { stdout: '' }
  })
  // @ts-ignore
  mockFs.readFile.mockResolvedValue('test content')
  // @ts-ignore
  mockFs.mkdir.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  mockFs.existsSync.mockReturnValue(true)

  await handler(mockReq as any, mockRes as any)

  expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'repo',
    state: 'open',
    head: 'lvce-editor:update-dependencies-',
  })

  // When an existing PR is found, it should update the branch, not create a new one
  expect(mockOctokit.rest.git.updateRef).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'repo',
    ref: 'heads/update-dependencies-1234567890',
    sha: 'new-commit-sha',
    force: true,
  })

  expect(mockRes.status).toHaveBeenCalledWith(200)
  expect(mockRes.send).toHaveBeenCalledWith('Dependencies update PR updated successfully')

  // Clean up environment variable
  if (originalBotUserId) {
    process.env.BOT_USER_ID = originalBotUserId
  } else {
    delete process.env.BOT_USER_ID
  }

  // Restore console.warn
  console.warn = originalWarn
})

test('handles dependency update failure', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        // @ts-ignore
        get: jest.fn().mockResolvedValue({}),
      },
    },
  }
  const app = {
    auth() {
      return mockOctokit
    },
  }

  const handler = handleDependencies({
    app: app as any,
    installationId: 1,
    secret: 'test-secret',
  })

  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'lvce-editor/repo',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  }

  // Mock a failure during dependency update
  jest.spyOn(console, 'error').mockImplementation(() => {})
  // @ts-ignore
  mockExeca.execa.mockRejectedValue(new Error('Failed to update package.json'))

  await handler(mockReq as any, mockRes as any)

  expect(mockRes.status).toHaveBeenCalledWith(424)
  expect(mockRes.json).toHaveBeenCalledWith({
    error: 'Failed to update dependencies',
    details: 'Failed to update package.json',
    code: 'DEPENDENCY_UPDATE_FAILED',
  })
})

test('retries updateDependencies and resets folder on ETARGET error', async () => {
  const { updateDependencies } = await import('../src/dependencies.js')
  const tmpFolder = '/tmp/test-retry-etarget'
  let callCount = 0
  mockExeca.execa.mockImplementation(async (cmd, args) => {
    const a = args as any
    if (cmd === 'bash') {
      callCount++
      if (callCount === 1) {
        const err = new Error('npm ERR! code ETARGET\nnpm ERR! notarget No matching version found for')
        // Simulate ETARGET error on first call
        throw err
      }
      // Succeed on second call
      return { stdout: '' }
    }
    if (cmd === 'git' && a[0] === 'reset' && a[1] === '--hard') {
      return { stdout: '' }
    }
    return { stdout: '' }
  })

  // Use a very short retryDelay for fast test
  await updateDependencies(tmpFolder, 2, 1)

  // Should have called bash script twice (first fails, second succeeds)
  expect(mockExeca.execa).toHaveBeenCalledWith('bash', [expect.any(String)], {
    cwd: tmpFolder,
  })
  // Should have called git reset --hard after the first failure
  expect(mockExeca.execa).toHaveBeenCalledWith('git', ['reset', '--hard'], {
    cwd: tmpFolder,
  })
  // Should have called the script at least twice
  expect(callCount).toBe(2)
})
