import type { Context, Probot } from 'probot'
import { captureException } from '../../errorHandling.ts'
import * as GithubWorker from '../../githubWorker.ts'
import { downloadMigrationArtifact } from '../DownloadMigrationArtifact/DownloadMigrationArtifact.ts'
import { assertAllowedTargetRepository } from '../MigrationSecurity/MigrationSecurity.ts'

const HELPER_BOT_OWNER = 'lvce-editor'
const HELPER_BOT_REPO = 'helper-bot'
// const WORKFLOW_NAME = 'run-migration-on-demand'
const WORKFLOW_EVENT = 'workflow_dispatch'
// @ts-ignore
const WORKFLOW_BRANCH = 'main'
const WORKFLOW_PATH = '.github/workflows/run-migration-on-demand.yml'
const ORG_RELEASE_PLAN_MIGRATION_ID = '/migrations2/plan-org-release-tags'
const LOG_PREFIX = '[HandleMigrationWorkflowRun]'

export interface CreateHandleMigrationWorkflowRunOptions {
  readonly app: Probot
  readonly downloadMigrationArtifact?: typeof downloadMigrationArtifact
  readonly invokeGithubWorker?: typeof GithubWorker.invoke
  readonly processInBackground?: boolean
}

interface Logger {
  readonly error: (...args: readonly unknown[]) => void
  readonly info: (...args: readonly unknown[]) => void
  readonly warn: (...args: readonly unknown[]) => void
}

const getMigrationLabel = (manifest: { artifactKind?: string; migrationId: string; targetRepository?: string }): string => {
  return `${manifest.targetRepository || manifest.artifactKind || 'unknown'} ${manifest.migrationId}`
}

const fallbackLogger: Logger = {
  error: (...args) => {
    console.error(...args)
  },
  info: (...args) => {
    console.warn(...args)
  },
  warn: (...args) => {
    console.warn(...args)
  },
}

const getLogger = (context: Context<'workflow_run'>): Logger => {
  return (context as any).log || fallbackLogger
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

const logGithubWorkerOutcome = (logger: Logger, migrationLabel: string, workerResult: any): void => {
  const workerData = getGithubWorkerData(workerResult)
  if (!workerData) {
    logger.info(`${LOG_PREFIX} ${migrationLabel}: workflow run produced no changes`)
    return
  }
  if (workerData.status === 'success') {
    const pullRequestSuffix = typeof workerData.pullRequestNumber === 'number' ? ` (#${workerData.pullRequestNumber})` : ''
    logger.info(`${LOG_PREFIX} made pr for ${migrationLabel}${pullRequestSuffix}`)
    return
  }
  logger.warn(`${LOG_PREFIX} ${migrationLabel}: github worker response status ${workerData.status || 'unknown'}`)
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

const isAllowedWorkflowRun = (workflowRun: Readonly<{ event: string; path: string }>): boolean => {
  return workflowRun.path === WORKFLOW_PATH && workflowRun.event === WORKFLOW_EVENT
}

export const createHandleMigrationWorkflowRun = (options: Readonly<CreateHandleMigrationWorkflowRunOptions>) => {
  const downloadArtifact = options.downloadMigrationArtifact || downloadMigrationArtifact
  const invokeGithubWorker = options.invokeGithubWorker || GithubWorker.invoke

  const processWorkflowRun = async (context: Context<'workflow_run'>): Promise<void> => {
    const { repository, workflow_run: workflowRun } = context.payload
    const logger = getLogger(context)
    let migrationLabel = `workflow run ${workflowRun.id}`
    try {
      logger.info(`${LOG_PREFIX} downloading migration artifact for run ${workflowRun.id}`)
      const artifact = await downloadArtifact({
        logger,
        octokit: context.octokit,
        owner: repository.owner.login,
        repo: repository.name,
        runId: workflowRun.id,
      })
      if (!artifact) {
        logger.info(`${LOG_PREFIX} ${migrationLabel}: no migration artifact found`)
        return
      }
      migrationLabel = getMigrationLabel(artifact.manifest)
      logger.info(`${LOG_PREFIX} received webhook migration on demand for ${migrationLabel}`)
      logger.info(`${LOG_PREFIX} ${migrationLabel}: artifact contains ${artifact.changedFiles.length} changed files`)
      if (artifact.manifest.status === 'error') {
        logger.error(
          `${LOG_PREFIX} failed to make pr for ${migrationLabel}`,
          artifact.manifest.errorCode || 'MIGRATION_WORKFLOW_ERROR',
          artifact.manifest.errorMessage || 'Migration workflow failed',
        )
        return
      }
      if (artifact.manifest.dryRun) {
        logger.info(`${LOG_PREFIX} ${migrationLabel}: dry run requested; ignoring migration result`)
        return
      }
      if (artifact.manifest.migrationId === ORG_RELEASE_PLAN_MIGRATION_ID) {
        const releasePlan = artifact.manifest.data?.releasePlan
        if (!releasePlan) {
          logger.warn(`${LOG_PREFIX} ${migrationLabel}: org release plan artifact is missing data.releasePlan`)
          return
        }
        const upgradeEntries = releasePlan.entries.filter((entry: any) => entry.upgrade)
        logger.info(`${LOG_PREFIX} ${migrationLabel}: release plan contains ${upgradeEntries.length} tag upgrades`)
        for (const entry of upgradeEntries) {
          try {
            if (!entry.newTag || !entry.targetSha) {
              logger.warn(`${LOG_PREFIX} ${entry.repository}: skipping incomplete release plan entry`)
              continue
            }
            const { owner, repo } = assertAllowedTargetRepository(entry.repository)
            const githubToken = await getInstallationToken(options.app, owner, repo)
            const workerResult = await invokeGithubWorker('/github/create-tag-ref', {
              githubToken,
              owner,
              repo,
              sha: entry.targetSha,
              tag: entry.newTag,
            })
            if (workerResult?.type === 'error') {
              throw new Error(workerResult.error || 'GitHub worker failed to create tag ref')
            }
            const workerData = getGithubWorkerData(workerResult)
            logger.info(`${LOG_PREFIX} ${entry.repository}: ${workerData?.message || `processed tag ${entry.newTag}`}`)
          } catch (error) {
            logger.error(`${LOG_PREFIX} failed to create release tag for ${entry.repository}`, error)
            captureException(error as Error)
          }
        }
        return
      }
      if (artifact.changedFiles.length === 0 && (!artifact.manifest.repoCommands || artifact.manifest.repoCommands.length === 0)) {
        logger.info(`${LOG_PREFIX} ${migrationLabel}: workflow run produced no changes`)
        return
      }
      if (!artifact.manifest.targetRepository) {
        logger.warn(`${LOG_PREFIX} ${migrationLabel}: migration artifact is missing targetRepository`)
        return
      }
      const { owner, repo } = assertAllowedTargetRepository(artifact.manifest.targetRepository)
      const githubToken = await getInstallationToken(options.app, owner, repo)
      logger.info(`${LOG_PREFIX} making pr for ${migrationLabel}`)
      const workerResult = await invokeGithubWorker('/github/apply-migration-result', {
        baseBranch: artifact.manifest.baseBranch,
        branchName: artifact.manifest.branchName,
        changedFiles: artifact.changedFiles,
        commitMessage: artifact.manifest.commitMessage,
        githubToken,
        owner,
        pullRequestTitle: artifact.manifest.pullRequestTitle,
        repo,
        ...(artifact.manifest.repoCommands ? { repoCommands: artifact.manifest.repoCommands } : {}),
      })
      logGithubWorkerOutcome(logger, migrationLabel, workerResult)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Target repository must belong to')) {
        logger.warn(`${LOG_PREFIX} ${migrationLabel}: ${error.message}`)
        return
      }
      logger.error(`${LOG_PREFIX} failed to make pr for ${migrationLabel}`, error)
      captureException(error as Error)
    }
  }

  return async (context: Context<'workflow_run'>): Promise<void> => {
    const { repository, workflow_run: workflowRun } = context.payload
    const logger = getLogger(context)
    if (repository.owner.login !== HELPER_BOT_OWNER || repository.name !== HELPER_BOT_REPO) {
      console.info(`[workflow_completed] repo mismatch`)
      return
    }
    if (!isAllowedWorkflowRun(workflowRun)) {
      console.info(`[workflow_completed] workflow mismatch: ${workflowRun.path} ${workflowRun.event}`)
      return
    }
    logger.info(`${LOG_PREFIX} received completed migration workflow webhook for run ${workflowRun.id}`)
    if (!options.processInBackground) {
      await processWorkflowRun(context)
      return
    }
    setImmediate(async () => {
      await processWorkflowRun(context)
    })
  }
}
