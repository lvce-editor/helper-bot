import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'

let errorSpy: jest.MockedFunction<(...args: readonly unknown[]) => void>
let infoSpy: jest.MockedFunction<(...args: readonly unknown[]) => void>
let warnSpy: jest.MockedFunction<(...args: readonly unknown[]) => void>
const PlannedReleaseBatch = await import('../src/parts/PlannedReleaseBatch/PlannedReleaseBatch.ts')

beforeEach(() => {
  errorSpy = jest.fn()
  infoSpy = jest.fn()
  warnSpy = jest.fn()
  PlannedReleaseBatch.resetPlannedReleaseBatch()
})

const MIGRATION_WORKFLOW_PATH = '.github/workflows/run-migration-on-demand.yml'
const ORG_RELEASE_PLAN_REQUEST_WORKFLOW_PATH = '.github/workflows/request-org-release-plan.yml'
const OLD_ORG_RELEASE_PLAN_WORKFLOW_PATH = '.github/workflows/nightly-org-release-plan.yml'

afterEach(() => {
  PlannedReleaseBatch.resetPlannedReleaseBatch()
  jest.restoreAllMocks()
})

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
    auth: (jest.fn() as any)
      .mockResolvedValueOnce({
        rest: {
          apps: {
            getRepoInstallation,
          },
        },
      })
      .mockResolvedValueOnce({
        auth,
      }) as any,
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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
    logger: context.log,
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
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] received completed migration workflow webhook for run 123')
  expect(infoSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] received webhook migration on demand for lvce-editor/lvce-editor.github.io /migrations2/update-website-config',
  )
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] making pr for lvce-editor/lvce-editor.github.io /migrations2/update-website-config')
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] made pr for lvce-editor/lvce-editor.github.io /migrations2/update-website-config')
})

test('ignores unrelated workflow runs', async () => {
  const downloadMigrationArtifact = jest.fn() as any
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: '.github/workflows/ci.yml',
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

test('dispatches org release plan migration when the request workflow completes successfully', async () => {
  const dispatchMigrationWorkflow = (jest.fn() as any).mockResolvedValue({
    requestId: 'request-release-plan',
  })
  const downloadMigrationArtifact = jest.fn() as any
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        conclusion: 'success',
        event: 'schedule',
        head_branch: 'main',
        id: 123,
        path: ORG_RELEASE_PLAN_REQUEST_WORKFLOW_PATH,
      },
    },
  }

  const { createHandleMigrationWorkflowRun } = await import('../src/parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts')
  const handleMigrationWorkflowRun = createHandleMigrationWorkflowRun({
    app,
    dispatchMigrationWorkflow,
    downloadMigrationArtifact,
    invokeGithubWorker,
  })

  await handleMigrationWorkflowRun(context)

  expect(dispatchMigrationWorkflow).toHaveBeenCalledWith({
    app,
    migrationId: '/migrations2/plan-org-release-tags',
    migrationOptions: {},
    targetRepository: 'lvce-editor/helper-bot',
  })
  expect(downloadMigrationArtifact).not.toHaveBeenCalled()
  expect(invokeGithubWorker).not.toHaveBeenCalled()
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] received completed org release plan request workflow webhook for run 123')
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] dispatched org release plan migration workflow')
})

test('ignores unsuccessful org release plan request workflow runs', async () => {
  const dispatchMigrationWorkflow = jest.fn() as any
  const downloadMigrationArtifact = jest.fn() as any
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        conclusion: 'failure',
        event: 'schedule',
        head_branch: 'main',
        id: 123,
        path: ORG_RELEASE_PLAN_REQUEST_WORKFLOW_PATH,
      },
    },
  }

  const { createHandleMigrationWorkflowRun } = await import('../src/parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts')
  const handleMigrationWorkflowRun = createHandleMigrationWorkflowRun({
    app,
    dispatchMigrationWorkflow,
    downloadMigrationArtifact,
    invokeGithubWorker,
  })

  await handleMigrationWorkflowRun(context)

  expect(dispatchMigrationWorkflow).not.toHaveBeenCalled()
  expect(downloadMigrationArtifact).not.toHaveBeenCalled()
  expect(invokeGithubWorker).not.toHaveBeenCalled()
})

test('ignores workflow runs that were not dispatched manually on main', async () => {
  const downloadMigrationArtifact = jest.fn() as any
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'pull_request',
        head_branch: 'feature/test',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

test('rejects artifacts that target repositories outside lvce-editor', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [
      {
        content: 'value\n',
        path: 'file.txt',
      },
    ],
    manifest: {
      migrationId: '/migrations2/update-website-config',
      requestId: 'request-1',
      status: 'success',
      targetRepository: 'other-org/example-repo',
    },
  })
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(app.auth).not.toHaveBeenCalled()
  expect(invokeGithubWorker).not.toHaveBeenCalled()
  expect(warnSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] other-org/example-repo /migrations2/update-website-config: Target repository must belong to lvce-editor',
  )
})

test('logs when a workflow artifact contains no changed files', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [],
    manifest: {
      migrationId: '/migrations2/update-dependencies',
      requestId: 'request-1',
      status: 'success',
      targetRepository: 'lvce-editor/explorer-view',
    },
  })
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(invokeGithubWorker).not.toHaveBeenCalled()
  expect(infoSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] lvce-editor/explorer-view /migrations2/update-dependencies: workflow run produced no changes',
  )
})

test('applies repo commands even when the artifact has no changed files', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [],
    manifest: {
      migrationId: '/migrations2/modernize-branch-protection',
      repoCommands: [
        {
          branch: 'main',
          type: 'modernize-branch-protection',
        },
      ],
      requestId: 'request-1',
      status: 'success',
      targetRepository: 'lvce-editor/explorer-view',
    },
  })
  const invokeGithubWorker = (jest.fn() as any).mockResolvedValue({
    data: {
      changedFiles: 0,
      message: 'Migration completed successfully',
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
    auth: (jest.fn() as any)
      .mockResolvedValueOnce({
        rest: {
          apps: {
            getRepoInstallation,
          },
        },
      })
      .mockResolvedValueOnce({
        auth,
      }) as any,
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(invokeGithubWorker).toHaveBeenCalledWith('/github/apply-migration-result', {
    baseBranch: undefined,
    branchName: undefined,
    changedFiles: [],
    commitMessage: undefined,
    githubToken: 'installation-token',
    owner: 'lvce-editor',
    pullRequestTitle: undefined,
    repo: 'explorer-view',
    repoCommands: [
      {
        branch: 'main',
        type: 'modernize-branch-protection',
      },
    ],
  })
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] made pr for lvce-editor/explorer-view /migrations2/modernize-branch-protection')
})

test('creates tag refs for upgrade entries in a manually dispatched org release plan artifact', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [],
    manifest: {
      data: {
        releasePlan: {
          entries: [
            {
              newTag: 'v1.3.0',
              repository: 'lvce-editor/example',
              targetSha: 'main-sha',
              upgrade: true,
            },
            {
              nonUpgradeReason: 'no recent commits',
              repository: 'lvce-editor/skipped',
              upgrade: false,
            },
            {
              repository: 'lvce-editor/incomplete',
              upgrade: true,
            },
          ],
          generatedAt: '2026-06-30T01:00:00.000Z',
          lookbackHours: 24,
          owner: 'lvce-editor',
          schemaVersion: 1,
          summary: {
            scanned: 3,
            skipped: 1,
            upgrade: 2,
          },
        },
      },
      migrationId: '/migrations2/plan-org-release-tags',
      requestId: 'nightly-1',
      status: 'success',
      targetRepository: 'lvce-editor/helper-bot',
    },
  })
  const invokeGithubWorker = (jest.fn() as any).mockResolvedValue({
    data: {
      message: 'Created tag v1.3.0',
      status: 'created',
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
    auth: (jest.fn() as any)
      .mockResolvedValueOnce({
        rest: {
          apps: {
            getRepoInstallation,
          },
        },
      })
      .mockResolvedValueOnce({
        auth,
      }) as any,
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(getRepoInstallation).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'example',
  })
  expect(invokeGithubWorker).toHaveBeenCalledWith('/github/create-tag-ref', {
    githubToken: 'installation-token',
    owner: 'lvce-editor',
    repo: 'example',
    sha: 'main-sha',
    tag: 'v1.3.0',
  })
  expect(invokeGithubWorker).toHaveBeenCalledTimes(1)
  expect(infoSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] lvce-editor/helper-bot /migrations2/plan-org-release-tags: release plan contains 2 tag upgrades',
  )
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] lvce-editor/example: Created tag v1.3.0')
  expect(warnSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] lvce-editor/incomplete: skipping incomplete release plan entry')
  expect(PlannedReleaseBatch.isPlannedReleasePending('lvce-editor/example', 'v1.3.0')).toBe(true)
})

test('dispatches pending dependency and builtin extension updates after all planned release workflows complete', async () => {
  PlannedReleaseBatch.startPlannedReleaseBatch([
    {
      repository: 'lvce-editor/activity-bar-worker',
      tagName: 'v1.1.0',
    },
    {
      repository: 'lvce-editor/status-bar-worker',
      tagName: 'v2.1.0',
    },
  ])
  PlannedReleaseBatch.addPendingDependencyUpdates([
    {
      fromRepo: 'activity-bar-worker',
      tagName: 'v1.1.0',
      toFolder: 'packages/renderer-worker',
      toRepo: 'lvce-editor',
    },
    {
      fromRepo: 'status-bar-worker',
      tagName: 'v2.1.0',
      toFolder: 'packages/renderer-worker',
      toRepo: 'lvce-editor',
    },
  ])
  PlannedReleaseBatch.addPendingBuiltinExtensionUpdate({ repositoryName: 'activity-bar-worker', tagName: 'v1.1.0' })
  PlannedReleaseBatch.addPendingBuiltinExtensionUpdate({ repositoryName: 'status-bar-worker', tagName: 'v2.1.0' })
  const dispatchMigrationWorkflow = (jest.fn() as any).mockResolvedValue({
    requestId: 'request-dependencies',
  })
  const app = {} as any
  const createContext = (repo: string, tag: string): any => ({
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
    payload: {
      action: 'completed',
      repository: {
        name: repo,
        owner: {
          login: 'lvce-editor',
        },
      },
      workflow_run: {
        event: 'push',
        head_branch: tag,
        id: 123,
        path: '.github/workflows/release.yml',
      },
    },
  })

  const { createHandleMigrationWorkflowRun } = await import('../src/parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts')
  const handleMigrationWorkflowRun = createHandleMigrationWorkflowRun({
    app,
    dispatchMigrationWorkflow,
  })

  await handleMigrationWorkflowRun(createContext('activity-bar-worker', 'v1.1.0'))
  expect(dispatchMigrationWorkflow).not.toHaveBeenCalled()

  await handleMigrationWorkflowRun(createContext('status-bar-worker', 'v2.1.0'))
  expect(dispatchMigrationWorkflow).toHaveBeenCalledWith({
    app,
    migrationId: '/migrations2/update-specific-dependencies',
    migrationOptions: {
      toRepo: 'lvce-editor',
      updates: [
        {
          fromRepo: 'activity-bar-worker',
          tagName: 'v1.1.0',
          toFolder: 'packages/renderer-worker',
          toRepo: 'lvce-editor',
        },
        {
          fromRepo: 'status-bar-worker',
          tagName: 'v2.1.0',
          toFolder: 'packages/renderer-worker',
          toRepo: 'lvce-editor',
        },
      ],
    },
    targetRepository: 'lvce-editor/lvce-editor',
  })
  expect(dispatchMigrationWorkflow).toHaveBeenCalledWith({
    app,
    migrationId: '/migrations2/update-builtin-extensions',
    migrationOptions: {
      updates: [
        {
          repositoryName: 'activity-bar-worker',
          tagName: 'v1.1.0',
        },
        {
          repositoryName: 'status-bar-worker',
          tagName: 'v2.1.0',
        },
      ],
    },
    targetRepository: 'lvce-editor/lvce-editor',
  })
})

test('dispatches pending dependency updates when planned release batch times out', async () => {
  jest.useFakeTimers()
  try {
    const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
      changedFiles: [],
      manifest: {
        data: {
          releasePlan: {
            entries: [
              {
                newTag: 'v1.1.0',
                repository: 'lvce-editor/activity-bar-worker',
                targetSha: 'main-sha',
                upgrade: true,
              },
              {
                newTag: 'v2.1.0',
                repository: 'lvce-editor/status-bar-worker',
                targetSha: 'main-sha',
                upgrade: true,
              },
            ],
          },
        },
        migrationId: '/migrations2/plan-org-release-tags',
        requestId: 'nightly-1',
        status: 'success',
        targetRepository: 'lvce-editor/helper-bot',
      },
    })
    const invokeGithubWorker = (jest.fn() as any).mockResolvedValue({
      data: {
        message: 'Created tag',
        status: 'created',
      },
      type: 'success',
    })
    const dispatchMigrationWorkflow = (jest.fn() as any).mockResolvedValue({
      requestId: 'request-dependencies',
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
      auth: (jest.fn() as any)
        .mockResolvedValueOnce({
          rest: {
            apps: {
              getRepoInstallation,
            },
          },
        })
        .mockResolvedValueOnce({
          auth,
        })
        .mockResolvedValueOnce({
          rest: {
            apps: {
              getRepoInstallation,
            },
          },
        })
        .mockResolvedValueOnce({
          auth,
        }) as any,
    }
    const context: any = {
      log: {
        error: errorSpy,
        info: infoSpy,
        warn: warnSpy,
      },
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
          event: 'workflow_dispatch',
          head_branch: 'main',
          id: 123,
          path: MIGRATION_WORKFLOW_PATH,
        },
      },
    }

    const { createHandleMigrationWorkflowRun } = await import('../src/parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts')
    const handleMigrationWorkflowRun = createHandleMigrationWorkflowRun({
      app,
      dispatchMigrationWorkflow,
      downloadMigrationArtifact,
      invokeGithubWorker,
    })

    await handleMigrationWorkflowRun(context)
    PlannedReleaseBatch.addPendingDependencyUpdates([
      {
        fromRepo: 'activity-bar-worker',
        tagName: 'v1.1.0',
        toFolder: 'packages/renderer-worker',
        toRepo: 'lvce-editor',
      },
    ])

    await jest.advanceTimersByTimeAsync(PlannedReleaseBatch.PlannedReleaseBatchTimeout)

    expect(dispatchMigrationWorkflow).toHaveBeenCalledWith({
      app,
      migrationId: '/migrations2/update-specific-dependencies',
      migrationOptions: {
        toRepo: 'lvce-editor',
        updates: [
          {
            fromRepo: 'activity-bar-worker',
            tagName: 'v1.1.0',
            toFolder: 'packages/renderer-worker',
            toRepo: 'lvce-editor',
          },
        ],
      },
      targetRepository: 'lvce-editor/lvce-editor',
    })
  } finally {
    jest.useRealTimers()
  }
})

test('ignores dry run org release plan artifacts without creating tag refs', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [],
    manifest: {
      data: {
        releasePlan: {
          entries: [
            {
              newTag: 'v1.3.0',
              repository: 'lvce-editor/example',
              targetSha: 'main-sha',
              upgrade: true,
            },
          ],
          generatedAt: '2026-06-30T01:00:00.000Z',
          lookbackHours: 24,
          owner: 'lvce-editor',
          schemaVersion: 1,
          summary: {
            scanned: 1,
            skipped: 0,
            upgrade: 1,
          },
        },
      },
      dryRun: true,
      migrationId: '/migrations2/plan-org-release-tags',
      requestId: 'nightly-dry-run',
      status: 'success',
      targetRepository: 'lvce-editor/helper-bot',
    },
  })
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(app.auth).not.toHaveBeenCalled()
  expect(invokeGithubWorker).not.toHaveBeenCalled()
  expect(infoSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] lvce-editor/helper-bot /migrations2/plan-org-release-tags: dry run requested; ignoring migration result',
  )
})

test('ignores the old dedicated org release plan workflow', async () => {
  const downloadMigrationArtifact = jest.fn() as any
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: OLD_ORG_RELEASE_PLAN_WORKFLOW_PATH,
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

test('ignores dry run migration artifacts without applying migration results', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [
      {
        content: 'new content',
        path: 'file.txt',
      },
    ],
    manifest: {
      baseBranch: 'main',
      branchName: 'feature/update-dependencies',
      commitMessage: 'chore: update dependencies',
      dryRun: true,
      migrationId: '/migrations2/update-dependencies',
      pullRequestTitle: 'chore: update dependencies',
      requestId: 'request-dry-run',
      status: 'success',
      targetRepository: 'lvce-editor/explorer-view',
    },
  })
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(app.auth).not.toHaveBeenCalled()
  expect(invokeGithubWorker).not.toHaveBeenCalled()
  expect(infoSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] lvce-editor/explorer-view /migrations2/update-dependencies: dry run requested; ignoring migration result',
  )
})

test('logs when the github worker reports no effective changes', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [
      {
        content: 'same content',
        path: 'file.txt',
      },
    ],
    manifest: {
      baseBranch: 'main',
      branchName: 'feature/update-dependencies',
      commitMessage: 'chore: update dependencies',
      migrationId: '/migrations2/update-dependencies',
      pullRequestTitle: 'chore: update dependencies',
      requestId: 'request-1',
      status: 'success',
      targetRepository: 'lvce-editor/explorer-view',
    },
  })
  const invokeGithubWorker = (jest.fn() as any).mockResolvedValue(undefined)
  const getRepoInstallation = (jest.fn() as any).mockResolvedValue({
    data: {
      id: 77,
    },
  })
  const auth = (jest.fn() as any).mockResolvedValue({
    token: 'installation-token',
  })
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
        auth,
      }) as any,
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(invokeGithubWorker).toHaveBeenCalledTimes(1)
  expect(infoSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] lvce-editor/explorer-view /migrations2/update-dependencies: workflow run produced no changes',
  )
})

test('logs failures from the github worker', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [
      {
        content: 'new content',
        path: 'file.txt',
      },
    ],
    manifest: {
      baseBranch: 'main',
      branchName: 'feature/update-dependencies',
      commitMessage: 'chore: update dependencies',
      migrationId: '/migrations2/update-dependencies',
      pullRequestTitle: 'chore: update dependencies',
      requestId: 'request-1',
      status: 'success',
      targetRepository: 'lvce-editor/explorer-view',
    },
  })
  const invokeGithubWorker = (jest.fn() as any).mockRejectedValue(new Error('worker failed'))
  const getRepoInstallation = (jest.fn() as any).mockResolvedValue({
    data: {
      id: 77,
    },
  })
  const auth = (jest.fn() as any).mockResolvedValue({
    token: 'installation-token',
  })
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
        auth,
      }) as any,
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
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

  expect(errorSpy).toHaveBeenCalledWith(
    '[HandleMigrationWorkflowRun] failed to make pr for lvce-editor/explorer-view /migrations2/update-dependencies',
    expect.any(Error),
  )
})

test('acknowledges migration workflow webhooks before processing in the background', async () => {
  const downloadMigrationArtifact = jest.fn() as any
  const invokeGithubWorker = jest.fn() as any
  const app: any = {
    auth: jest.fn(),
  }
  const context: any = {
    log: {
      error: errorSpy,
      info: infoSpy,
      warn: warnSpy,
    },
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
        event: 'workflow_dispatch',
        head_branch: 'main',
        id: 123,
        path: MIGRATION_WORKFLOW_PATH,
      },
    },
  }

  const { createHandleMigrationWorkflowRun } = await import('../src/parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts')
  const handleMigrationWorkflowRun = createHandleMigrationWorkflowRun({
    app,
    downloadMigrationArtifact,
    invokeGithubWorker,
    processInBackground: true,
  })

  await handleMigrationWorkflowRun(context)

  expect(downloadMigrationArtifact).not.toHaveBeenCalled()
  await new Promise((resolve) => {
    setImmediate(resolve)
  })
  expect(downloadMigrationArtifact).toHaveBeenCalledWith({
    logger: context.log,
    octokit: context.octokit,
    owner: 'lvce-editor',
    repo: 'helper-bot',
    runId: 123,
  })
})
