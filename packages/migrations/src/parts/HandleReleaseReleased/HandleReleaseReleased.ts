import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { updateRepositoryDependencies } from '../UpdateRepositoryDependencies/UpdateRepositoryDependencies.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export interface HandleReleaseReleasedOptions extends BaseMigrationOptions {
  tagName: string
  repositoryName: string
}

export const handleReleaseReleased = async (
  options: Readonly<HandleReleaseReleasedOptions>,
): Promise<MigrationResult> => {
  try {
    // Call updateRepositoryDependencies
    const repositoryDependenciesResult = await updateRepositoryDependencies({
      ...options,
      tagName: options.tagName,
      repositoryName: options.repositoryName,
    })

    if (repositoryDependenciesResult.status === 'error') {
      return repositoryDependenciesResult
    }

    // Return success - updateBuiltinExtensions will be handled separately by the app
    // since it needs to update a different repo (lvce-editor)
    return createMigrationResult({
      status: 'success',
      changedFiles: repositoryDependenciesResult.changedFiles,
      pullRequestTitle: `feature: handle release ${options.repositoryName}@${options.tagName}`,
    })
  } catch (error) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: `feature: handle release ${options.repositoryName}@${options.tagName}`,
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
    })
  }
}
