import type { Context, Probot } from 'probot'
import { captureException } from '../../errorHandling.ts'
import * as GithubWorker from '../../githubWorker.ts'
import { downloadMigrationArtifact } from '../DownloadMigrationArtifact/DownloadMigrationArtifact.ts'
import { assertAllowedTargetRepository } from '../MigrationSecurity/MigrationSecurity.ts'

const HELPER_BOT_OWNER = 'lvce-editor'
const HELPER_BOT_REPO = 'helper-bot'
const WORKFLOW_NAME = 'run-migration-on-demand'
const WORKFLOW_EVENT = 'workflow_dispatch'
const WORKFLOW_BRANCH = 'main'
const LOG_PREFIX = '[HandleMigrationWorkflowRun]'

export interface CreateHandleMigrationWorkflowRunOptions {
  readonly app: Probot
  readonly downloadMigrationArtifact?: typeof downloadMigrationArtifact
  readonly invokeGithubWorker?: typeof GithubWorker.invoke
}

const getMigrationLabel = (manifest: { migrationId: string; targetRepository: string }): string => {
  return `${manifest.targetRepository} ${manifest.migrationId}`
}

const getGithubWorkerData = (result: any): any => {
  if (!result) {
    return undefined
  }
  if (result.type === 'success') {
    return result.data
  }
  return result
}

const getInstallationToken = async (app: Probot, owner: string, repo: string): Promise<string> => {
  const appOctokit = await app.auth()
  const installation = await appOctokit.rest.apps.getRepoInstallation({
    owner,
    repo,
  })
  const octokit = await app.auth(installation.data.id)
  const authToken: any = await octokit.auth({
    type: 'installation',
  })
  return typeof authToken === 'string' ? authToken : authToken.token
}

export const createHandleMigrationWorkflowRun = (options: Readonly<CreateHandleMigrationWorkflowRunOptions>) => {
  const downloadArtifact = options.downloadMigrationArtifact || downloadMigrationArtifact
  const invokeGithubWorker = options.invokeGithubWorker || GithubWorker.invoke

  return async (context: Context<'workflow_run'>): Promise<void> => {
    const { action, repository, workflow_run: workflowRun } = context.payload as any
    if (action !== 'completed') {
      return
    }
    if (repository.owner.login !== HELPER_BOT_OWNER || repository.name !== HELPER_BOT_REPO) {
      return
    }
    if (workflowRun.name !== WORKFLOW_NAME) {
      return
    }
    if (workflowRun.event !== WORKFLOW_EVENT) {
      return
    }
    if (workflowRun.head_branch !== WORKFLOW_BRANCH) {
      return
    }
    console.log(`${LOG_PREFIX} received completed migration workflow webhook for run ${workflowRun.id}`)
    let migrationLabel = `workflow run ${workflowRun.id}`
    try {
      const artifact = await downloadArtifact({
        octokit: context.octokit,
        owner: repository.owner.login,
        repo: repository.name,
        runId: workflowRun.id,
      })
      if (!artifact) {
        console.log(`${LOG_PREFIX} ${migrationLabel}: no migration artifact found`)
        return
      }
      migrationLabel = getMigrationLabel(artifact.manifest)
      console.log(`${LOG_PREFIX} received webhook migration on demand for ${migrationLabel}`)
      if (artifact.manifest.status === 'error') {
        console.error(
          `${LOG_PREFIX} failed to make pr for ${migrationLabel}`,
          artifact.manifest.errorCode || 'MIGRATION_WORKFLOW_ERROR',
          artifact.manifest.errorMessage || 'Migration workflow failed',
        )
        return
      }
      if (artifact.changedFiles.length === 0) {
        console.log(`${LOG_PREFIX} ${migrationLabel}: workflow run produced no changes`)
        return
      }
      const { owner, repo } = assertAllowedTargetRepository(artifact.manifest.targetRepository)
      const githubToken = await getInstallationToken(options.app, owner, repo)
      console.log(`${LOG_PREFIX} making pr for ${migrationLabel}`)
      const workerResult = await invokeGithubWorker('/github/apply-migration-result', {
        baseBranch: artifact.manifest.baseBranch,
        branchName: artifact.manifest.branchName,
        changedFiles: artifact.changedFiles,
        commitMessage: artifact.manifest.commitMessage,
        githubToken,
        owner,
        pullRequestTitle: artifact.manifest.pullRequestTitle,
        repo,
      })
      const workerData = getGithubWorkerData(workerResult)
      if (!workerData) {
        console.log(`${LOG_PREFIX} ${migrationLabel}: workflow run produced no changes`)
        return
      }
      if (workerData.status === 'success') {
        const pullRequestSuffix = typeof workerData.pullRequestNumber === 'number' ? ` (#${workerData.pullRequestNumber})` : ''
        console.log(`${LOG_PREFIX} made pr for ${migrationLabel}${pullRequestSuffix}`)
        return
      }
      console.log(`${LOG_PREFIX} ${migrationLabel}: github worker response status ${workerData.status || 'unknown'}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Target repository must belong to')) {
        console.warn(`${LOG_PREFIX} ${migrationLabel}: ${error.message}`)
        return
      }
      console.error(`${LOG_PREFIX} failed to make pr for ${migrationLabel}`, error)
      captureException(error as Error)
    }
  }
}
