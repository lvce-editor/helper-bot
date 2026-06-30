import type { Probot } from 'probot'
import { CronJob } from 'cron'
import { captureException } from './errorHandling.ts'

const HELPER_BOT_OWNER = 'lvce-editor'
const HELPER_BOT_REPO = 'helper-bot'
const RELEASE_WORKFLOW_FILE_NAME = 'nightly-org-release-plan.yml'
const WORKFLOW_REF = 'main'

interface ReleaseCronConfig {
  readonly expression: string
  readonly timezone: string
}

interface Logger {
  readonly error: (...args: readonly unknown[]) => void
  readonly info: (...args: readonly unknown[]) => void
}

interface CronJobFactory {
  readonly from: (params: {
    readonly cronTime: string
    readonly name: string
    readonly onTick: () => Promise<void>
    readonly start: boolean
    readonly timeZone: string
    readonly waitForCompletion: boolean
  }) => unknown
}

export interface StartReleaseSchedulerOptions {
  readonly app: Probot
  readonly CronJobConstructor?: CronJobFactory
  readonly env?: NodeJS.ProcessEnv
  readonly logger?: Logger
  readonly releaseCron?: ReleaseCronConfig
}

export const dispatchNightlyReleaseWorkflow = async (app: Probot): Promise<void> => {
  const appOctokit = await app.auth()
  const installation = await appOctokit.rest.apps.getRepoInstallation({
    owner: HELPER_BOT_OWNER,
    repo: HELPER_BOT_REPO,
  })
  const octokit = await app.auth(installation.data.id)
  await octokit.rest.actions.createWorkflowDispatch({
    owner: HELPER_BOT_OWNER,
    ref: WORKFLOW_REF,
    repo: HELPER_BOT_REPO,
    workflow_id: RELEASE_WORKFLOW_FILE_NAME,
  })
}

export const startReleaseScheduler = (options: Readonly<StartReleaseSchedulerOptions>): unknown => {
  const env = options.env || process.env
  if (env.NODE_ENV !== 'production') {
    return undefined
  }
  if (!options.releaseCron) {
    throw new Error('Missing release cron config')
  }
  const logger = options.logger || console
  const CronJobCtor = options.CronJobConstructor || CronJob
  return CronJobCtor.from({
    cronTime: options.releaseCron.expression,
    name: 'nightly-org-release-plan',
    onTick: async () => {
      try {
        logger.info('[ReleaseScheduler] dispatching nightly org release plan workflow')
        await dispatchNightlyReleaseWorkflow(options.app)
        logger.info('[ReleaseScheduler] dispatched nightly org release plan workflow')
      } catch (error) {
        logger.error('[ReleaseScheduler] failed to dispatch nightly org release plan workflow', error)
        captureException(error as Error)
      }
    },
    start: true,
    timeZone: options.releaseCron.timezone,
    waitForCompletion: true,
  })
}
