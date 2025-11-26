import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import dependenciesConfig from '../../dependencies.json' with { type: 'json' }

export interface UpdateRepositoryDependenciesOptions
  extends BaseMigrationOptions {
  tagName: string
  repositoryName: string
}

export const updateRepositoryDependencies = async (
  options: Readonly<UpdateRepositoryDependenciesOptions>,
): Promise<MigrationResult> => {
  try {
    const dependencies = dependenciesConfig.dependencies
    const releasedRepo = options.repositoryName

    // Find dependencies that match this repository
    const matchingDependencies = dependencies.filter(
      (dep) => dep.fromRepo === releasedRepo,
    )

    if (matchingDependencies.length === 0) {
      return createMigrationResult({
        status: 'success',
        changedFiles: [],
        pullRequestTitle: `feature: update dependencies for ${releasedRepo}`,
      })
    }

    // Return success - the actual updates are handled by the app calling updateDependencies for each target repo
    // This migration just provides the list of dependencies that need to be updated
    return createMigrationResult({
      status: 'success',
      changedFiles: [],
      pullRequestTitle: `feature: update dependencies for ${releasedRepo}`,
    })
  } catch (error) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: `feature: update dependencies for ${options.repositoryName}`,
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
    })
  }
}

