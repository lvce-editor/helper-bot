import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type InitializePackageJsonOptions = BaseMigrationOptions

export const initializePackageJson = async (options: Readonly<InitializePackageJsonOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    // Check if package.json already exists
    const exists = await options.fs.exists(packageJsonPath)
    if (exists) {
      return emptyMigrationResult
    }

    // Create a basic package.json
    const packageJsonContent =
      JSON.stringify(
        {
          name: options.repositoryName,
          version: '1.0.0',
          description: '',
        },
        null,
        2,
      ) + '\n'

    return {
      branchName: 'feature/initialize-package-json',
      changedFiles: [
        {
          content: packageJsonContent,
          path: 'package.json',
        },
      ],
      commitMessage: 'chore: initialize package.json',
      pullRequestTitle: 'chore: initialize package.json',
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.INITIALIZE_PACKAGE_JSON_FAILED,
      errorMessage: stringifyError(error),
      status: 'error' as const,
    }
    return {
      changedFiles: [],
      errorCode: errorResult.errorCode,
      errorMessage: errorResult.errorMessage,
      status: 'error',
      statusCode: getHttpStatusCode(errorResult),
    }
  }
}
