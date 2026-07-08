import type { Probot } from 'probot'
import { downloadMigrationArtifact, type DownloadMigrationArtifactResult } from '../DownloadMigrationArtifact/DownloadMigrationArtifact.ts'

const HELPER_BOT_OWNER = 'lvce-editor'
const HELPER_BOT_REPO = 'helper-bot'
const WORKFLOW_FILE_NAME = 'run-migration-on-demand.yml'
const MAX_WORKFLOW_RUNS_TO_SCAN = 50

export interface GetMigrationRequestStatusOptions {
  readonly app: Probot
  readonly downloadMigrationArtifact?: typeof downloadMigrationArtifact
  readonly requestId: string
}

export interface MigrationRequestRun {
  readonly conclusion?: string | null
  readonly htmlUrl?: string
  readonly id: number
  readonly name?: string
  readonly status?: string | null
}

export interface MigrationRequestStatus {
  readonly artifact?: DownloadMigrationArtifactResult
  readonly requestId: string
  readonly run?: MigrationRequestRun
  readonly status: 'completed' | 'pending' | 'running'
}

const getHelperBotOctokit = async (app: Probot): Promise<any> => {
  const appOctokit = await app.auth()
  const installation = await appOctokit.rest.apps.getRepoInstallation({
    owner: HELPER_BOT_OWNER,
    repo: HELPER_BOT_REPO,
  })
  return app.auth(installation.data.id)
}

const getRunNameSuffix = (requestId: string): string => {
  return `/${requestId}`
}

const isMatchingWorkflowRun = (run: any, requestId: string): boolean => {
  return typeof run.display_title === 'string' && run.display_title.endsWith(getRunNameSuffix(requestId))
}

const toMigrationRequestRun = (run: any): MigrationRequestRun => {
  return {
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    id: run.id,
    name: run.display_title,
    status: run.status,
  }
}

export const getMigrationRequestStatus = async (options: Readonly<GetMigrationRequestStatusOptions>): Promise<MigrationRequestStatus> => {
  const downloadArtifact = options.downloadMigrationArtifact || downloadMigrationArtifact
  const octokit = await getHelperBotOctokit(options.app)
  const runsResponse = await octokit.rest.actions.listWorkflowRuns({
    event: 'workflow_dispatch',
    owner: HELPER_BOT_OWNER,
    per_page: MAX_WORKFLOW_RUNS_TO_SCAN,
    repo: HELPER_BOT_REPO,
    workflow_id: WORKFLOW_FILE_NAME,
  })
  const runs = Array.isArray(runsResponse.data.workflow_runs) ? runsResponse.data.workflow_runs : []
  const run = runs.find((candidate: any) => isMatchingWorkflowRun(candidate, options.requestId))
  if (!run) {
    return {
      requestId: options.requestId,
      status: 'pending',
    }
  }

  const requestRun = toMigrationRequestRun(run)
  if (run.status !== 'completed') {
    return {
      requestId: options.requestId,
      run: requestRun,
      status: 'running',
    }
  }

  const artifact = await downloadArtifact({
    octokit,
    owner: HELPER_BOT_OWNER,
    repo: HELPER_BOT_REPO,
    runId: run.id,
  })
  return {
    ...(artifact && { artifact }),
    requestId: options.requestId,
    run: requestRun,
    status: 'completed',
  }
}
