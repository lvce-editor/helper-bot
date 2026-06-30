import { expect, jest, test } from '@jest/globals'

test('starts configured release cron in production and dispatches the nightly workflow', async () => {
  let cronParams: any
  const CronJobConstructor = {
    from: jest.fn((params: any) => {
      cronParams = params
      return {
        name: params.name,
      }
    }),
  }
  const getRepoInstallation = (jest.fn() as any).mockResolvedValue({
    data: {
      id: 77,
    },
  })
  const createWorkflowDispatch = (jest.fn() as any).mockResolvedValue({})
  const app: any = {
    auth: (jest.fn() as any)
      .mockResolvedValueOnce({
        rest: {
          apps: {
            getRepoInstallation,
          },
        },
      })
      .mockResolvedValueOnce({
        rest: {
          actions: {
            createWorkflowDispatch,
          },
        },
      }),
  }
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  }

  const { startReleaseScheduler } = await import('../src/releaseScheduler.ts')
  const job = startReleaseScheduler({
    app,
    CronJobConstructor,
    env: {
      NODE_ENV: 'production',
    } as any,
    logger,
    releaseCron: {
      expression: '5 4 * * *',
      timezone: 'Europe/Berlin',
    },
  })

  expect(job).toEqual({
    name: 'nightly-org-release-plan',
  })
  expect(CronJobConstructor.from).toHaveBeenCalledWith({
    cronTime: '5 4 * * *',
    name: 'nightly-org-release-plan',
    onTick: expect.any(Function),
    start: true,
    timeZone: 'Europe/Berlin',
    waitForCompletion: true,
  })

  await cronParams.onTick()

  expect(getRepoInstallation).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'helper-bot',
  })
  expect(app.auth).toHaveBeenCalledWith(77)
  expect(createWorkflowDispatch).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    ref: 'main',
    repo: 'helper-bot',
    workflow_id: 'nightly-org-release-plan.yml',
  })
  expect(logger.error).not.toHaveBeenCalled()
})

test('does not start release cron outside production', async () => {
  const CronJobConstructor = {
    from: jest.fn(),
  }
  const app: any = {
    auth: jest.fn(),
  }

  const { startReleaseScheduler } = await import('../src/releaseScheduler.ts')
  const job = startReleaseScheduler({
    app,
    CronJobConstructor,
    env: {
      NODE_ENV: 'test',
    } as any,
    releaseCron: {
      expression: '0 3 * * *',
      timezone: 'Europe/Berlin',
    },
  })

  expect(job).toBeUndefined()
  expect(CronJobConstructor.from).not.toHaveBeenCalled()
  expect(app.auth).not.toHaveBeenCalled()
})
