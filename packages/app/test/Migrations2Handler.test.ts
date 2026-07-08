import { beforeEach, expect, jest, test } from '@jest/globals'

const mockDispatchMigrationWorkflow = jest.fn()
const mockGetMigrationRequestStatus = jest.fn()
const mockCaptureException = jest.fn()

jest.unstable_mockModule('../src/parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts', () => ({
  dispatchMigrationWorkflow: mockDispatchMigrationWorkflow,
}))

jest.unstable_mockModule('../src/parts/GetMigrationRequestStatus/GetMigrationRequestStatus.ts', () => ({
  getMigrationRequestStatus: mockGetMigrationRequestStatus,
}))

jest.unstable_mockModule('../src/errorHandling.ts', () => ({
  captureException: mockCaptureException,
}))

const { createMigrationRequestStatusHandler, createMigrations2Handler } = await import('../src/migrations2/endpoints.ts')

beforeEach(() => {
  mockDispatchMigrationWorkflow.mockReset()
  mockDispatchMigrationWorkflow.mockResolvedValue({
    requestId: 'request-1',
    runName: 'migration-on-demand/example-repo/update-website-config/request-1',
  })
  mockGetMigrationRequestStatus.mockReset()
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

test('passes dry run as dispatch metadata instead of a migration option', async () => {
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        dryRun: true,
        releasedTag: 'v1.0.0',
        repository: 'lvce-editor/example-repo',
      },
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/migrations2/update-website-config',
    } as any,
    response,
  )

  expect(mockDispatchMigrationWorkflow).toHaveBeenCalledWith({
    app: {},
    baseBranch: 'main',
    dryRun: true,
    migrationId: '/migrations2/update-website-config',
    migrationOptions: {
      releasedTag: 'v1.0.0',
    },
    targetRepository: 'lvce-editor/example-repo',
  })
  expect(response.status).toHaveBeenCalledWith(202)
  expect(response.json).toHaveBeenCalledWith({
    message: 'Migration workflow dispatched successfully',
    requestId: 'request-1',
    runName: 'migration-on-demand/example-repo/update-website-config/request-1',
    status: 'queued',
    statusUrl: '/my-app/migrations2/requests/request-1',
  })
})

test('rejects non-boolean dry run values', async () => {
  const response = createResponse()
  const handler = createMigrations2Handler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      body: {
        dryRun: 'true',
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
    code: 'INVALID_DRY_RUN',
    error: 'Invalid dryRun parameter',
  })
  expect(mockDispatchMigrationWorkflow).not.toHaveBeenCalled()
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

test('returns migration request status', async () => {
  const response = createResponse()
  mockGetMigrationRequestStatus.mockResolvedValue({
    requestId: 'request-1',
    status: 'running',
  })
  const handler = createMigrationRequestStatusHandler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/migrations2/requests/request-1',
    } as any,
    response,
  )

  expect(mockGetMigrationRequestStatus).toHaveBeenCalledWith({
    app: {},
    requestId: 'request-1',
  })
  expect(response.status).toHaveBeenCalledWith(200)
  expect(response.json).toHaveBeenCalledWith({
    requestId: 'request-1',
    status: 'running',
  })
})

test('rejects invalid migration request ids', async () => {
  const response = createResponse()
  const handler = createMigrationRequestStatusHandler({
    app: {} as any,
    secret: 'top-secret',
  })

  await handler(
    {
      headers: {
        authorization: 'Bearer top-secret',
      },
      path: '/migrations2/requests/request:1',
    } as any,
    response,
  )

  expect(response.status).toHaveBeenCalledWith(400)
  expect(response.json).toHaveBeenCalledWith({
    code: 'INVALID_REQUEST_ID',
    error: 'Invalid request id',
  })
  expect(mockGetMigrationRequestStatus).not.toHaveBeenCalled()
})
