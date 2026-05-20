import { runMigrationWorkflow } from './parts/RunMigrationWorkflow/RunMigrationWorkflow.ts'

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const main = async (): Promise<void> => {
  const result = await runMigrationWorkflow({
    ...(process.env.BASE_BRANCH ? { baseBranch: process.env.BASE_BRANCH } : {}),
    ...(process.env.GITHUB_TOKEN ? { githubToken: process.env.GITHUB_TOKEN } : {}),
    migrationId: getRequiredEnv('MIGRATION_ID'),
    ...(process.env.MIGRATION_OPTIONS_JSON ? { migrationOptionsJson: process.env.MIGRATION_OPTIONS_JSON } : {}),
    outputDir: getRequiredEnv('MIGRATION_ARTIFACT_DIR'),
    requestId: getRequiredEnv('REQUEST_ID'),
    targetRepository: getRequiredEnv('TARGET_REPOSITORY'),
  })
  if (result.status === 'error') {
    process.exitCode = 1
  }
}

void main()
