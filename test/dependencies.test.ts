import { expect, jest, test } from '@jest/globals'

const mockExeca = {
  execa: jest.fn(),
}

const mockFs = {
  mkdir: jest.fn(),
  rm: jest.fn(),
}

jest.unstable_mockModule('execa', () => mockExeca)
jest.unstable_mockModule('node:fs/promises', () => mockFs)
jest.unstable_mockModule('node:os', () => ({
  tmpdir: () => '/test',
}))

const { handleDependencies } = await import('../src/dependencies.js')

test('verifies secret correctly', async () => {
  const handler = handleDependencies({
    octokit: {} as any,
    secret: 'test-secret',
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
  const handler = handleDependencies({
    octokit: {} as any,
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
      pulls: {
        // @ts-ignore
        create: jest.fn().mockResolvedValue({ data: { node_id: 'test-id' } }),
      },
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const handler = handleDependencies({
    octokit: mockOctokit as any,
    secret: 'test-secret',
  })

  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'owner/repo',
    },
  }
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
  // @ts-ignore
  mockExeca.execa.mockResolvedValue({} as any)
  // @ts-ignore
  mockFs.mkdir.mockResolvedValue({} as any)
  // @ts-ignore
  mockFs.rm.mockResolvedValue({} as any)

  await handler(mockReq as any, mockRes as any)

  expect(mockRes.status).toHaveBeenCalledWith(200)
  expect(mockRes.send).toHaveBeenCalledWith(
    'Dependencies update PR created successfully',
  )
  expect(mockOctokit.rest.pulls.create).toHaveBeenCalled()
  expect(mockOctokit.graphql).toHaveBeenCalled()
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

  const handler = handleDependencies({
    octokit: mockOctokit as any,
    secret: 'test-secret',
  })

  const mockReq = {
    query: {
      secret: 'test-secret',
      repositoryName: 'owner/repo',
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
  const handler = handleDependencies({
    octokit: {} as any,
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
