import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type AddLintScriptOptions = BaseMigrationOptions

export const addLintScript = async (options: Readonly<AddLintScriptOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    // Check if package.json exists
    const exists = await options.fs.exists(packageJsonPath)
    if (!exists) {
      return emptyMigrationResult
    }

    // Read and parse package.json
    const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)

    // Check if lint script already exists
    if (packageJson.scripts && packageJson.scripts.lint) {
      return emptyMigrationResult
    }

    // Add lint script
    if (!packageJson.scripts) {
      packageJson.scripts = {}
    }
    packageJson.scripts.lint = 'eslint . && prettier --check .'

    // Stringify with proper formatting
    const newPackageJsonContent = JSON.stringify(packageJson, null, 2) + '\n'

    return {
      branchName: 'feature/add-lint-script',
      changedFiles: [
        {
          content: newPackageJsonContent,
          path: 'package.json',
        },
      ],
      commitMessage: 'feature: add lint script',
      pullRequestTitle: 'feature: add lint script',
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.ADD_LINT_SCRIPT_FAILED,
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
