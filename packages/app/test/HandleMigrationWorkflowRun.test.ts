import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'

let errorSpy: jest.MockedFunction<(...args: readonly unknown[]) => void>
let infoSpy: jest.MockedFunction<(...args: readonly unknown[]) => void>
let warnSpy: jest.MockedFunction<(...args: readonly unknown[]) => void>

beforeEach(() => {
  errorSpy = jest.fn()
  infoSpy = jest.fn()
  warnSpy = jest.fn()
})

const MIGRATION_WORKFLOW_PATH = '.github/workflows/run-migration-on-demand.yml'
const ORG_RELEASE_PLAN_WORKFLOW_PATH = '.github/workflows/nightly-org-release-plan.yml'

afterEach(() => {
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

test('creates tag refs for upgrade entries in a scheduled org release plan artifact', async () => {
  const downloadMigrationArtifact = (jest.fn() as any).mockResolvedValue({
    changedFiles: [],
    manifest: {
      artifactKind: 'org-release-plan',
      generatedAt: '2026-06-30T01:00:00.000Z',
      migrationId: '/migrations2/plan-org-release-tags',
      requestId: 'nightly-1',
      status: 'success',
    },
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
      ],
      generatedAt: '2026-06-30T01:00:00.000Z',
      lookbackHours: 24,
      owner: 'lvce-editor',
      schemaVersion: 1,
      summary: {
        scanned: 2,
        skipped: 1,
        upgrade: 1,
      },
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
        event: 'schedule',
        head_branch: 'main',
        id: 123,
        path: ORG_RELEASE_PLAN_WORKFLOW_PATH,
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
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] org-release-plan /migrations2/plan-org-release-tags: release plan contains 1 tag upgrades')
  expect(infoSpy).toHaveBeenCalledWith('[HandleMigrationWorkflowRun] lvce-editor/example: Created tag v1.3.0')
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
