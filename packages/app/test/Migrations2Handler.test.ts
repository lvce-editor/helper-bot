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
