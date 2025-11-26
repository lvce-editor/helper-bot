import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { updateRepositoryDependencies } from '../UpdateRepositoryDependencies/UpdateRepositoryDependencies.ts'
import { updateBuiltinExtensions } from '../UpdateBuiltinExtensions/UpdateBuiltinExtensions.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export interface HandleReleaseReleasedOptions extends BaseMigrationOptions {
  tagName: string
  repositoryName: string
  targetOwner?: string
  targetRepo?: string
  targetFilePath?: string
}

export const handleReleaseReleased = async (
  options: Readonly<HandleReleaseReleasedOptions>,
): Promise<MigrationResult> => {
  try {
    const releasedRepo = options.repositoryName
    const allChangedFiles: Array<{ path: string; content: string }> = []

    // Call updateRepositoryDependencies
    const repositoryDependenciesResult = await updateRepositoryDependencies({
      ...options,
      tagName: options.tagName,
      repositoryName: releasedRepo,
    })

    if (repositoryDependenciesResult.status === 'error') {
      return repositoryDependenciesResult
    }

    allChangedFiles.push(...repositoryDependenciesResult.changedFiles)

    // Handle updateBuiltinExtensions if target repo is provided and not renderer-process
    if (
      releasedRepo !== 'renderer-process' &&
      options.targetOwner &&
      options.targetRepo &&
      options.targetFilePath &&
      options.clonedRepoPath
    ) {
      const builtinExtensionsResult = await updateBuiltinExtensions({
        ...options,
        tagName: options.tagName,
        releasedRepositoryName: releasedRepo,
        targetFilePath: options.targetFilePath,
      })

      if (builtinExtensionsResult.status === 'error') {
        return builtinExtensionsResult
      }

      allChangedFiles.push(...builtinExtensionsResult.changedFiles)
    }

    return createMigrationResult({
      status: 'success',
      changedFiles: allChangedFiles,
      pullRequestTitle: `feature: handle release ${releasedRepo}@${options.tagName}`,
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
