import type { Probot } from 'probot'
import { randomUUID } from 'node:crypto'
import { assertAllowedTargetRepository, assertSafeMigrationOptions, isValidBaseBranch } from '../MigrationSecurity/MigrationSecurity.ts'

const HELPER_BOT_OWNER = 'lvce-editor'
const HELPER_BOT_REPO = 'helper-bot'
const WORKFLOW_FILE_NAME = 'run-migration-on-demand.yml'
const WORKFLOW_REF = 'main'

const getTargetRepositoryName = (targetRepository: string): string => {
  const parts = targetRepository.split('/').filter(Boolean)
  return parts.at(-1) || targetRepository
}

const getMigrationName = (migrationId: string): string => {
  const parts = migrationId.split('/').filter(Boolean)
  return parts.at(-1) || migrationId
}

const getRunName = (targetRepository: string, migrationId: string): string => {
  return `migration-on-demand/${getTargetRepositoryName(targetRepository)}/${getMigrationName(migrationId)}`
}

export interface DispatchMigrationWorkflowOptions {
  readonly app: Probot
  readonly baseBranch?: string
  readonly migrationId: string
  readonly migrationOptions: Record<string, any>
  readonly requestId?: string
  readonly targetRepository: string
}

export interface DispatchMigrationWorkflowResult {
  readonly requestId: string
}

export const dispatchMigrationWorkflow = async (options: Readonly<DispatchMigrationWorkflowOptions>): Promise<DispatchMigrationWorkflowResult> => {
  assertAllowedTargetRepository(options.targetRepository)
  assertSafeMigrationOptions(options.migrationOptions)
  if (options.baseBranch && !isValidBaseBranch(options.baseBranch)) {
    throw new Error('Invalid base branch')
  }
  const requestId = options.requestId || randomUUID()
  const runName = getRunName(options.targetRepository, options.migrationId)
  const appOctokit = await options.app.auth()
  const installation = await appOctokit.rest.apps.getRepoInstallation({
    owner: HELPER_BOT_OWNER,
    repo: HELPER_BOT_REPO,
  })
  const octokit = await options.app.auth(installation.data.id)
  await octokit.rest.actions.createWorkflowDispatch({
    inputs: {
      baseBranch: options.baseBranch || 'main',
      migrationId: options.migrationId,
      migrationOptionsJson: JSON.stringify(options.migrationOptions),
      requestId,
      runName,
      targetRepository: options.targetRepository,
    },
    owner: HELPER_BOT_OWNER,
    ref: WORKFLOW_REF,
    repo: HELPER_BOT_REPO,
    workflow_id: WORKFLOW_FILE_NAME,
  })
  return {
    requestId,
  }
}
