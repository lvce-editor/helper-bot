import { runMigrationWorkflow } from './parts/RunMigrationWorkflow/RunMigrationWorkflow.ts'

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const logMigrationContext = (message: string, data: Record<string, unknown>): void => {
  console.info(`[run-migration-workflow] ${message} ${JSON.stringify(data)}`)
}

const main = async (): Promise<void> => {
  const migrationId = getRequiredEnv('MIGRATION_ID')
  const requestId = getRequiredEnv('REQUEST_ID')
  const targetRepository = getRequiredEnv('TARGET_REPOSITORY')
  logMigrationContext('starting', {
    baseBranch: process.env.BASE_BRANCH || 'main',
    migrationId,
    requestId,
    targetRepository,
  })
  const result = await runMigrationWorkflow({
    ...(process.env.BASE_BRANCH ? { baseBranch: process.env.BASE_BRANCH } : {}),
    ...(process.env.GITHUB_TOKEN ? { githubToken: process.env.GITHUB_TOKEN } : {}),
    migrationId,
    ...(process.env.MIGRATION_OPTIONS_JSON ? { migrationOptionsJson: process.env.MIGRATION_OPTIONS_JSON } : {}),
    outputDir: getRequiredEnv('MIGRATION_ARTIFACT_DIR'),
    requestId,
    targetRepository,
  })
  logMigrationContext('completed', {
    changedFiles: result.changedFiles.length,
    errorCode: 'errorCode' in result ? result.errorCode : undefined,
    errorMessage: 'errorMessage' in result ? result.errorMessage : undefined,
    status: result.status,
    statusCode: result.statusCode,
  })
  if (result.status === 'error') {
    console.error(
      `[run-migration-workflow] migration failed for ${targetRepository}: ${result.errorMessage || result.errorCode || 'unknown error'}`,
    )
    process.exitCode = 1
  }
}

void main().catch((error) => {
  console.error('[run-migration-workflow] fatal error', error)
  process.exitCode = 1
})
