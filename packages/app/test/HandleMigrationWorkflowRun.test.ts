import { expect, jest, test } from '@jest/globals'

test('applies an uploaded migration artifact when the workflow run completes', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [
      {
        content: '{\n  "version": "1.0.0"\n}\n',
        path: 'packages/website/config.json',
      },
    ],
    manifest: {
      baseBranch: 'main',
      branchName: 'feature/update-website-config',
      commitMessage: 'feature: update website config',
      migrationId: '/migrations2/update-website-config',
      pullRequestTitle: 'feature: update website config',
      requestId: 'request-1',
      status: 'success',
      targetRepository: 'lvce-editor/lvce-editor.github.io',
    },
  })
  const invokeGithubWorker = (jest.fn() as any).mockResolvedValue({
    data: {
      status: 'success',
    },
    type: 'success',
  })
  const getRepoInstallation = (jest.fn() as any).mockResolvedValue({
    data: {
      id: 77,
    },
  })
  const auth = (jest.fn() as any).mockResolvedValue({
    token: 'installation-token',
  })
  const app: any = {
    auth: ((jest.fn() as any)
      .mockResolvedValueOnce({
        rest: {
          apps: {
            getRepoInstallation,
          },
        },
      })
      .mockResolvedValueOnce({
        auth,
      })) as any,
  }
  const context: any = {
    octokit: {},
    payload: {
      action: 'completed',
      repository: {
        name: 'helper-bot',
        owner: {
          login: 'lvce-editor',
        },
      },
      workflow_run: {
        id: 123,
        name: 'run-migration-on-demand',
      },
    },
  }

  const { createHandleMigrationWorkflowRun } = await import('../src/parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts')
  const handleMigrationWorkflowRun = createHandleMigrationWorkflowRun({
    app,
    downloadMigrationArtifact,
    invokeGithubWorker,
  })

  await handleMigrationWorkflowRun(context)

  expect(downloadMigrationArtifact).toHaveBeenCalledWith({
    octokit: context.octokit,
    owner: 'lvce-editor',
    repo: 'helper-bot',
    runId: 123,
  })
  expect(getRepoInstallation).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'lvce-editor.github.io',
  })
  expect(auth).toHaveBeenCalledWith({
    type: 'installation',
  })
  expect(invokeGithubWorker).toHaveBeenCalledWith('/github/apply-migration-result', {
    baseBranch: 'main',
    branchName: 'feature/update-website-config',
    changedFiles: [
      {
        content: '{\n  "version": "1.0.0"\n}\n',
        path: 'packages/website/config.json',
      },
    ],
    commitMessage: 'feature: update website config',
    githubToken: 'installation-token',
    owner: 'lvce-editor',
    pullRequestTitle: 'feature: update website config',
    repo: 'lvce-editor.github.io',
  })
})

test('ignores unrelated workflow runs', async () => {
  const downloadMigrationArtifact = jest.fn() as any
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    octokit: {},
    payload: {
      action: 'completed',
      repository: {
        name: 'helper-bot',
        owner: {
          login: 'lvce-editor',
        },
      },
      workflow_run: {
        id: 123,
        name: 'ci',
      },
    },
  }

  const { createHandleMigrationWorkflowRun } = await import('../src/parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts')
  const handleMigrationWorkflowRun = createHandleMigrationWorkflowRun({
    app,
    downloadMigrationArtifact,
    invokeGithubWorker,
  })

  await handleMigrationWorkflowRun(context)

  expect(downloadMigrationArtifact).not.toHaveBeenCalled()
  expect(invokeGithubWorker).not.toHaveBeenCalled()
})
