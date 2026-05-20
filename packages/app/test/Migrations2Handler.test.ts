import { expect, jest, test } from '@jest/globals'

const createResponse = (): any => {
  const response: any = {
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  }
  return response
}

test('rejects repositories outside the lvce-editor organization', async () => {
  const { createMigrations2Handler } = await import('../src/migrations2/endpoints.ts')
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
  const { createMigrations2Handler } = await import('../src/migrations2/endpoints.ts')
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
  const { createMigrations2Handler } = await import('../src/migrations2/endpoints.ts')
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
