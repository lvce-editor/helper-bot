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
      dryRun: 'false',
      migrationId: '/migrations2/update-website-config',
      migrationOptionsJson: '{"releasedTag":"v1.0.0"}',
      requestId: 'request-1',
      runName: 'migration-on-demand/lvce-editor.github.io/update-website-config/request-1',
      targetRepository: 'lvce-editor/lvce-editor.github.io',
    },
    owner: 'lvce-editor',
    ref: 'main',
    repo: 'helper-bot',
    workflow_id: 'run-migration-on-demand.yml',
  })
  expect(result).toEqual({
    requestId: 'request-1',
    runName: 'migration-on-demand/lvce-editor.github.io/update-website-config/request-1',
  })
})

test('dispatches the on-demand migration workflow as a dry run', async () => {
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
  await dispatchMigrationWorkflow({
    app,
    dryRun: true,
    migrationId: '/migrations2/plan-org-release-tags',
    migrationOptions: {},
    requestId: 'request-dry-run',
    targetRepository: 'lvce-editor/helper-bot',
  })

  expect(createWorkflowDispatch).toHaveBeenCalledWith({
    inputs: {
      baseBranch: 'main',
      dryRun: 'true',
      migrationId: '/migrations2/plan-org-release-tags',
      migrationOptionsJson: '{}',
      requestId: 'request-dry-run',
      runName: 'migration-on-demand/helper-bot/plan-org-release-tags/request-dry-run',
      targetRepository: 'lvce-editor/helper-bot',
    },
    owner: 'lvce-editor',
    ref: 'main',
    repo: 'helper-bot',
    workflow_id: 'run-migration-on-demand.yml',
  })
})

test('rejects target repositories outside the lvce-editor organization', async () => {
  const app: any = {
    auth: jest.fn(),
  }

  const { dispatchMigrationWorkflow } = await import('../src/parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts')

  await expect(
    dispatchMigrationWorkflow({
      app,
      migrationId: '/migrations2/update-website-config',
      migrationOptions: {},
      targetRepository: 'other-org/example-repo',
    }),
  ).rejects.toThrow('Target repository must belong to lvce-editor')

  expect(app.auth).not.toHaveBeenCalled()
})

test('rejects migration options that look like secrets', async () => {
  const app: any = {
    auth: jest.fn(),
  }

  const { dispatchMigrationWorkflow } = await import('../src/parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts')

  await expect(
    dispatchMigrationWorkflow({
      app,
      migrationId: '/migrations2/update-website-config',
      migrationOptions: {
        nested: {
          githubToken: 'secret-value',
        },
      },
      targetRepository: 'lvce-editor/lvce-editor.github.io',
    }),
  ).rejects.toThrow('Migration option "nested.githubToken" looks like a secret and must not be sent to the workflow')

  expect(app.auth).not.toHaveBeenCalled()
})
