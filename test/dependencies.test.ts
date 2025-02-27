import { expect, jest, test } from '@jest/globals'

const mockExeca = {
  execa: jest.fn(),
}

const mockFs = {
  mkdir: jest.fn(),
  rm: jest.fn(),
  readFile: jest.fn(),
}

jest.unstable_mockModule('execa', () => mockExeca)
jest.unstable_mockModule('node:fs/promises', () => mockFs)
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
  expect(mockRes.send).toHaveBeenCalledWith(
    'Dependencies update PR created successfully',
  )
})

test.only('handles no changes case', async () => {
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
  expect(mockRes.send).toHaveBeenCalledWith(
    'Repository owner must be lvce-editor',
  )
})
