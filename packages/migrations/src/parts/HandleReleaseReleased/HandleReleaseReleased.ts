import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { updateRepositoryDependencies } from '../UpdateRepositoryDependencies/UpdateRepositoryDependencies.ts'
import { updateBuiltinExtensions } from '../UpdateBuiltinExtensions/UpdateBuiltinExtensions.ts'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export interface HandleReleaseReleasedOptions extends BaseMigrationOptions {
  tagName: string
  repositoryName: string
}

export const handleReleaseReleased = async (options: Readonly<HandleReleaseReleasedOptions>): Promise<MigrationResult> => {
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

    // Handle updateBuiltinExtensions if not renderer-process
    if (releasedRepo !== 'renderer-process') {
      const targetOwner = options.repositoryOwner
      const targetRepo = 'lvce-editor'
      const targetFilePath = 'packages/build/src/parts/DownloadBuiltinExtensions/builtinExtensions.json'

      // Clone the target repo for builtin extensions update
      const clonedTargetRepo = await cloneRepositoryTmp(targetOwner, targetRepo)

      try {
        const builtinExtensionsResult = await updateBuiltinExtensions({
          ...options,
          repositoryOwner: targetOwner,
          repositoryName: targetRepo,
          tagName: options.tagName,
          releasedRepositoryName: releasedRepo,
          targetFilePath,
          clonedRepoPath: clonedTargetRepo.path,
        })

        if (builtinExtensionsResult.status === 'error') {
          return builtinExtensionsResult
        }

        allChangedFiles.push(...builtinExtensionsResult.changedFiles)
      } finally {
        await clonedTargetRepo[Symbol.asyncDispose]()
      }
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
