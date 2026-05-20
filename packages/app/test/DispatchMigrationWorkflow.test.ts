import { expect, jest, test } from '@jest/globals'

test('dispatches the on-demand migration workflow in the helper-bot repository', async () => {
  const getRepoInstallation = jest.fn().mockResolvedValue({
    data: {
      id: 42,
    },
  })
  const createWorkflowDispatch = jest.fn().mockResolvedValue({})
  const app: any = {
    auth: jest
      .fn()
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

  const { dispatchMigrationWorkflow } = await import('../src/parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts')
  const result = await dispatchMigrationWorkflow({
    app,
    baseBranch: 'main',
    migrationId: '/migrations2/update-website-config',
    migrationOptions: {
      releasedTag: 'v1.0.0',
    },
    requestId: 'request-1',
    targetRepository: 'lvce-editor/lvce-editor.github.io',
  })

  expect(getRepoInstallation).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'helper-bot',
  })
  expect(createWorkflowDispatch).toHaveBeenCalledWith({
    inputs: {
      baseBranch: 'main',
      migrationId: '/migrations2/update-website-config',
      migrationOptionsJson: '{"releasedTag":"v1.0.0"}',
      requestId: 'request-1',
      targetRepository: 'lvce-editor/lvce-editor.github.io',
    },
    owner: 'lvce-editor',
    ref: 'main',
    repo: 'helper-bot',
    workflow_id: 'run-migration-on-demand.yml',
  })
  expect(result).toEqual({
    requestId: 'request-1',
  })
})
