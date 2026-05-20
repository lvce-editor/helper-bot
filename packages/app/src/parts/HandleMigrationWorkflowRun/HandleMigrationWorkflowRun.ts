import type { Context, Probot } from 'probot'
import { captureException } from '../../errorHandling.ts'
import * as GithubWorker from '../../githubWorker.ts'
import { downloadMigrationArtifact } from '../DownloadMigrationArtifact/DownloadMigrationArtifact.ts'

const HELPER_BOT_OWNER = 'lvce-editor'
const HELPER_BOT_REPO = 'helper-bot'
const WORKFLOW_NAME = 'run-migration-on-demand'

export interface CreateHandleMigrationWorkflowRunOptions {
  readonly app: Probot
  readonly downloadMigrationArtifact?: typeof downloadMigrationArtifact
  readonly invokeGithubWorker?: typeof GithubWorker.invoke
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
    try {
      const artifact = await downloadArtifact({
        octokit: context.octokit,
        owner: repository.owner.login,
        repo: repository.name,
        runId: workflowRun.id,
      })
      if (!artifact) {
        return
      }
      if (artifact.manifest.status === 'error') {
        console.error(artifact.manifest.errorCode || 'MIGRATION_WORKFLOW_ERROR', artifact.manifest.errorMessage || 'Migration workflow failed')
        return
      }
      if (artifact.changedFiles.length === 0) {
        return
      }
      const [owner, repo] = artifact.manifest.targetRepository.split('/')
      const githubToken = await getInstallationToken(options.app, owner, repo)
      await invokeGithubWorker('/github/apply-migration-result', {
        baseBranch: artifact.manifest.baseBranch,
        branchName: artifact.manifest.branchName,
        changedFiles: artifact.changedFiles,
        commitMessage: artifact.manifest.commitMessage,
        githubToken,
        owner,
        pullRequestTitle: artifact.manifest.pullRequestTitle,
        repo,
      })
    } catch (error) {
      captureException(error as Error)
    }
  }
}
