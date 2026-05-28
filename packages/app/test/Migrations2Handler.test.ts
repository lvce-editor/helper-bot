import { beforeEach, expect, jest, test } from '@jest/globals'

const mockDispatchMigrationWorkflow = jest.fn()
const mockCaptureException = jest.fn()

jest.unstable_mockModule('../src/parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts', () => ({
  dispatchMigrationWorkflow: mockDispatchMigrationWorkflow,
}))

jest.unstable_mockModule('../src/errorHandling.ts', () => ({
  captureException: mockCaptureException,
}))

const { createMigrations2Handler } = await import('../src/migrations2/endpoints.ts')

beforeEach(() => {
  mockDispatchMigrationWorkflow.mockReset()
  mockDispatchMigrationWorkflow.mockResolvedValue({
    requestId: 'request-1',
  })
  mockCaptureException.mockReset()
})

const createResponse = (): any => {
  const response: any = {
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  }
  return response
}

test('rejects repositories outside the lvce-editor organization', async () => {
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        repository: 'other-org/example-repo',
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/migrations2/update-website-config',
    } as any,
    response,
  )

  expect(response.status).toHaveBeenCalledWith(403)
  expect(response.json).toHaveBeenCalledWith({
    code: 'FORBIDDEN_REPOSITORY',
    error: 'Target repository must belong to lvce-editor',
  })
})

test('rejects migration options that look like secrets', async () => {
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        githubToken: 'secret-value',
        repository: 'lvce-editor/example-repo',
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/migrations2/update-website-config',
    } as any,
    response,
  )

  expect(response.status).toHaveBeenCalledWith(400)
  expect(response.json).toHaveBeenCalledWith({
    code: 'SENSITIVE_MIGRATION_OPTION',
    error: 'Migration option "githubToken" looks like a secret and must not be sent to the workflow',
  })
})

test('does not log the raw request body', async () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        repository: 'other-org/example-repo',
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/migrations2/update-website-config',
    } as any,
    response,
  )

  expect(consoleLog).not.toHaveBeenCalled()
  consoleLog.mockRestore()
})

test('returns a dedicated error when GitHub Actions is unavailable', async () => {
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })
  const error: any = new Error('Failed to run workflow dispatch - https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event')
  error.status = 500
  mockDispatchMigrationWorkflow.mockRejectedValue(error)

  await handler(
    {
      body: {
        repository: 'lvce-editor/example-repo',
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/migrations2/update-all-dependencies',
    } as any,
    response,
  )

  expect(response.status).toHaveBeenCalledWith(500)
  expect(response.json).toHaveBeenCalledWith({
    code: 'E_GITHUB_ACTIONS_UNAVAILABLE',
    error: 'Migration failed because Github Actions is currently unavailble',
  })
  expect(mockCaptureException).toHaveBeenCalledWith(error)
})

test('dispatches one workflow per repository for multi-migrations', async () => {
  mockDispatchMigrationWorkflow
    .mockResolvedValueOnce({
      requestId: 'request-1',
    })
    .mockResolvedValueOnce({
      requestId: 'request-2',
    })
  const app = {} as any
  const response = createResponse()
  const handler = createMigrations2Handler({
    app,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        migrationName: '/migrations2/update-node-version',
        migrationOptions: {
          version: '24.16.0',
        },
        repositoryNames: ['lvce-editor/editor-worker', 'lvce-editor/helper-bot'],
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/multi-migrations/generic',
    } as any,
    response,
  )

  expect(mockDispatchMigrationWorkflow).toHaveBeenCalledTimes(2)
  expect(mockDispatchMigrationWorkflow).toHaveBeenNthCalledWith(1, {
    app,
    baseBranch: 'main',
    migrationId: '/migrations2/update-node-version',
    migrationOptions: {
      version: '24.16.0',
    },
    targetRepository: 'lvce-editor/editor-worker',
  })
  expect(mockDispatchMigrationWorkflow).toHaveBeenNthCalledWith(2, {
    app,
    baseBranch: 'main',
    migrationId: '/migrations2/update-node-version',
    migrationOptions: {
      version: '24.16.0',
    },
    targetRepository: 'lvce-editor/helper-bot',
  })
  expect(response.status).toHaveBeenCalledWith(202)
  expect(response.json).toHaveBeenCalledWith({
    message: 'Migration workflows dispatched successfully',
    results: [
      {
        repository: 'lvce-editor/editor-worker',
        requestId: 'request-1',
      },
      {
        repository: 'lvce-editor/helper-bot',
        requestId: 'request-2',
      },
    ],
    status: 'queued',
    total: 2,
  })
})

test('rejects multi-migration repositories outside the lvce-editor organization', async () => {
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        migrationName: '/migrations2/update-node-version',
        migrationOptions: {},
        repositoryNames: ['other-org/example-repo'],
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/multi-migrations/generic',
    } as any,
    response,
  )

  expect(response.status).toHaveBeenCalledWith(403)
  expect(response.json).toHaveBeenCalledWith({
    code: 'FORBIDDEN_REPOSITORY',
    error: 'Target repository must belong to lvce-editor',
  })
  expect(mockDispatchMigrationWorkflow).not.toHaveBeenCalled()
})

test('rejects multi-migration options that look like secrets', async () => {
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        migrationName: '/migrations2/update-node-version',
        migrationOptions: {
          nested: {
            githubToken: 'secret-value',
          },
        },
        repositoryNames: ['lvce-editor/helper-bot'],
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/multi-migrations/generic',
    } as any,
    response,
  )

  expect(response.status).toHaveBeenCalledWith(400)
  expect(response.json).toHaveBeenCalledWith({
    code: 'SENSITIVE_MIGRATION_OPTION',
    error: 'Migration option "nested.githubToken" looks like a secret and must not be sent to the workflow',
  })
  expect(mockDispatchMigrationWorkflow).not.toHaveBeenCalled()
})
