import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type CleanPackageJsonOptions = BaseMigrationOptions

export const cleanPackageJson = async (options: Readonly<CleanPackageJsonOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    // Check if package.json exists
    const exists = await options.fs.exists(packageJsonPath)
    if (!exists) {
      return emptyMigrationResult
    }

    // Read package.json
    const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)

    let hasChanges = false

    // Set license to "MIT" if not set
    if (!packageJson.license) {
      packageJson.license = 'MIT'
      hasChanges = true
    }

    // Remove empty keywords array if it exists
    if (Array.isArray(packageJson.keywords) && packageJson.keywords.length === 0) {
      delete packageJson.keywords
      hasChanges = true
    }

    // Remove empty skip array if it exists
    if (Array.isArray(packageJson.skip) && packageJson.skip.length === 0) {
      delete packageJson.skip
      hasChanges = true
    }

    // Remove description field if it's an empty string
    if (packageJson.description === '') {
      delete packageJson.description
      hasChanges = true
    }

    // Set author to "Lvce Editor" if author field is empty
    if (!packageJson.author || packageJson.author === '') {
      packageJson.author = 'Lvce Editor'
      hasChanges = true
    }

    // If no changes, return empty result
    if (!hasChanges) {
      return emptyMigrationResult
    }

    // Format the updated package.json
    const newPackageJsonContent = JSON.stringify(packageJson, null, 2) + '\n'

    return {
      branchName: 'feature/clean-package-json',
      changedFiles: [
        {
          content: newPackageJsonContent,
          path: 'package.json',
        },
      ],
      commitMessage: 'chore: clean package.json',
      pullRequestTitle: 'chore: clean package.json',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.CLEAN_PACKAGE_JSON_FAILED,
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
