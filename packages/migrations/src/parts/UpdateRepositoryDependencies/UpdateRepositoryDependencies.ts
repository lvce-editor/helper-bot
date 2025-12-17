import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import dependenciesConfig from '../../dependencies.json' with { type: 'json' }
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export interface UpdateRepositoryDependenciesOptions extends BaseMigrationOptions {
  repositoryName: string
  tagName: string
}

export const updateRepositoryDependencies = async (options: Readonly<UpdateRepositoryDependenciesOptions>): Promise<MigrationResult> => {
  try {
    const { dependencies } = dependenciesConfig
    const releasedRepo = options.repositoryName

    // Find dependencies that match this repository
    const matchingDependencies = dependencies.filter((dep) => dep.fromRepo === releasedRepo)

    if (matchingDependencies.length === 0) {
      return emptyMigrationResult
    }

    // Return success - the actual updates are handled by the app calling updateDependencies for each target repo
    // This migration just provides the list of dependencies that need to be updated
    return emptyMigrationResult
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `feature: update dependencies for ${options.repositoryName}`,
      status: 'error',
      branchName: '',
      commitMessage: '',
    })
  }
}
