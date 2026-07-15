import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, createValidationErrorMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

const EXPECTED_REPOSITORY_NAME = 'lvce-startup-benchmark'
const VERSION_COUNT = 150
const VERSIONS_PATH = 'versions.json'

export type UpdateStartupBenchmarkVersionsOptions = BaseMigrationOptions

export const updateStartupBenchmarkVersions = async (options: Readonly<UpdateStartupBenchmarkVersionsOptions>): Promise<MigrationResult> => {
  try {
    if (options.repositoryName !== EXPECTED_REPOSITORY_NAME) {
      return createValidationErrorMigrationResult(
        `This migration can only be run on repository "${EXPECTED_REPOSITORY_NAME}", but got "${options.repositoryName}"`,
      )
    }

    const versionsUri = resolveUri(VERSIONS_PATH, options.clonedRepoUri.endsWith('/') ? options.clonedRepoUri : `${options.clonedRepoUri}/`)
    if (!(await options.fs.exists(versionsUri))) {
      return createValidationErrorMigrationResult(`${VERSIONS_PATH} not found`)
    }

    const oldContent = await options.fs.readFile(versionsUri, 'utf8')
    await options.exec('npm', ['run', 'update-versions', '--', '--count', String(VERSION_COUNT)], {
      cwd: options.clonedRepoUri,
    })
    const newContent = await options.fs.readFile(versionsUri, 'utf8')

    if (newContent === oldContent) {
      return emptyMigrationResult
    }

    const commitMessage = 'feature: update startup benchmark versions'
    return {
      branchName: 'feature/update-startup-benchmark-versions',
      changedFiles: [
        {
          content: newContent,
          path: VERSIONS_PATH,
        },
      ],
      commitMessage,
      pullRequestTitle: commitMessage,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.UPDATE_STARTUP_BENCHMARK_VERSIONS_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
