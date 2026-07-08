import { expect, jest, test } from '@jest/globals'
import { getMigrationRequestStatus } from '../src/parts/GetMigrationRequestStatus/GetMigrationRequestStatus.ts'

const createApp = (workflowRuns: readonly any[]): any => {
  const getRepoInstallation = jest.fn().mockResolvedValue({
    data: {
      id: 42,
    },
  })
  const listWorkflowRuns = jest.fn().mockResolvedValue({
    data: {
      workflow_runs: workflowRuns,
    },
  })
  const app = {
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
            listWorkflowRuns,
          },
        },
      }),
  }
  return {
    app,
    getRepoInstallation,
    listWorkflowRuns,
  }
}

test('returns pending when the workflow run is not visible yet', async () => {
  const { app, listWorkflowRuns } = createApp([])

  const result = await getMigrationRequestStatus({
    app,
    requestId: 'request-1',
  })

  expect(listWorkflowRuns).toHaveBeenCalledWith({
    event: 'workflow_dispatch',
    owner: 'lvce-editor',
    per_page: 50,
    repo: 'helper-bot',
    workflow_id: 'run-migration-on-demand.yml',
  })
  expect(result).toEqual({
    requestId: 'request-1',
    status: 'pending',
  })
})

test('returns running when the workflow run has not completed', async () => {
  const { app } = createApp([
    {
      conclusion: null,
      display_title: 'migration-on-demand/helper-bot/plan-org-release-tags/request-1',
      html_url: 'https://github.com/lvce-editor/helper-bot/actions/runs/123',
      id: 123,
      status: 'in_progress',
    },
  ])

  const result = await getMigrationRequestStatus({
    app,
    requestId: 'request-1',
  })

  expect(result).toEqual({
    requestId: 'request-1',
    run: {
      conclusion: null,
      htmlUrl: 'https://github.com/lvce-editor/helper-bot/actions/runs/123',
      id: 123,
      name: 'migration-on-demand/helper-bot/plan-org-release-tags/request-1',
      status: 'in_progress',
    },
    status: 'running',
  })
})

test('downloads the artifact when the workflow run has completed', async () => {
  const { app } = createApp([
    {
      conclusion: 'success',
      display_title: 'migration-on-demand/helper-bot/plan-org-release-tags/request-1',
      html_url: 'https://github.com/lvce-editor/helper-bot/actions/runs/123',
      id: 123,
      status: 'completed',
    },
  ])
  const downloadMigrationArtifact = jest.fn().mockResolvedValue({
    changedFiles: [],
    manifest: {
      data: {
        releasePlan: {
          summary: {
            scanned: 1,
            skipped: 0,
            upgrade: 1,
          },
        },
      },
      migrationId: '/migrations2/plan-org-release-tags',
      requestId: 'request-1',
      status: 'success',
    },
  })

  const result = await getMigrationRequestStatus({
    app,
    downloadMigrationArtifact,
    requestId: 'request-1',
  })

  expect(downloadMigrationArtifact).toHaveBeenCalledWith({
    octokit: expect.any(Object),
    owner: 'lvce-editor',
    repo: 'helper-bot',
    runId: 123,
  })
  expect(result).toEqual({
    artifact: {
      changedFiles: [],
      manifest: {
        data: {
          releasePlan: {
            summary: {
              scanned: 1,
              skipped: 0,
              upgrade: 1,
            },
          },
        },
        migrationId: '/migrations2/plan-org-release-tags',
        requestId: 'request-1',
        status: 'success',
      },
    },
    requestId: 'request-1',
    run: {
      conclusion: 'success',
      htmlUrl: 'https://github.com/lvce-editor/helper-bot/actions/runs/123',
      id: 123,
      name: 'migration-on-demand/helper-bot/plan-org-release-tags/request-1',
      status: 'completed',
    },
    status: 'completed',
  })
})
