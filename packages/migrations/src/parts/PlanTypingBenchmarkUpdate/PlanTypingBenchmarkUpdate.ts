import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, createValidationErrorMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNpmVersion } from '../GetLatestNpmVersion/GetLatestNpmVersion.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

const EXPECTED_REPOSITORY_OWNER = 'lvce-editor'
const EXPECTED_REPOSITORY_NAME = 'lvce-typing-benchmark'
const TARGET_PACKAGE_NAMES = ['editor-worker', 'server', 'static-server'] as const

export type PlanTypingBenchmarkUpdateOptions = BaseMigrationOptions

export const planTypingBenchmarkUpdate = async (options: Readonly<PlanTypingBenchmarkUpdateOptions>): Promise<MigrationResult> => {
  try {
    if (options.repositoryOwner !== EXPECTED_REPOSITORY_OWNER || options.repositoryName !== EXPECTED_REPOSITORY_NAME) {
      return createValidationErrorMigrationResult('This migration can only be run in lvce-editor/helper-bot')
    }

    const packageJsonUri = resolveUri('package.json', options.clonedRepoUri)
    const packageJson = JSON.parse(await options.fs.readFile(packageJsonUri, 'utf8'))
    const updates = []
    for (const packageName of TARGET_PACKAGE_NAMES) {
      const dependencyName = `@lvce-editor/${packageName}`
      const currentVersion = packageJson.dependencies?.[dependencyName]
      if (typeof currentVersion !== 'string') {
        continue
      }
      const latestVersion = await getLatestNpmVersion(dependencyName, options.fetch)
      if (currentVersion === latestVersion) {
        continue
      }
      updates.push({
        fromRepo: packageName,
        tagName: `v${latestVersion}`,
        toFolder: '.',
      })
    }

    return {
      changedFiles: [],
      data: {
        updates,
      },
      pullRequestTitle: 'plan-typing-benchmark-update',
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.PLAN_TYPING_BENCHMARK_UPDATE_FAILED,
      errorMessage: error instanceof Error ? error.message : String(error),
      status: 'error',
    })
  }
}
