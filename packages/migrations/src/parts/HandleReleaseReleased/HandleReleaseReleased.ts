import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { updateBuiltinExtensions } from '../UpdateBuiltinExtensions/UpdateBuiltinExtensions.ts'
import { updateRepositoryDependencies } from '../UpdateRepositoryDependencies/UpdateRepositoryDependencies.ts'
import { pathToUri } from '../UriUtils/UriUtils.ts'

export interface HandleReleaseReleasedOptions extends BaseMigrationOptions {
  repositoryName: string
  tagName: string
}

export const handleReleaseReleased = async (options: Readonly<HandleReleaseReleasedOptions>): Promise<MigrationResult> => {
  try {
    const releasedRepo = options.repositoryName
    const allChangedFiles: Array<{ path: string; content: string }> = []

    // Call updateRepositoryDependencies
    const repositoryDependenciesResult = await updateRepositoryDependencies({
      ...options,
      repositoryName: releasedRepo,
      tagName: options.tagName,
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
          clonedRepoUri: pathToUri(clonedTargetRepo.path),
          releasedRepositoryName: releasedRepo,
          repositoryName: targetRepo,
          repositoryOwner: targetOwner,
          tagName: options.tagName,
          targetFilePath,
        })

        if (builtinExtensionsResult.status === 'error') {
          return builtinExtensionsResult
        }

        allChangedFiles.push(...builtinExtensionsResult.changedFiles)
      } finally {
        await clonedTargetRepo[Symbol.asyncDispose]()
      }
    }

    return {
      branchName: `feature/handle-release-${releasedRepo}-${options.tagName}`,
      changedFiles: allChangedFiles,
      commitMessage: `feature: handle release ${releasedRepo}@${options.tagName}`,
      pullRequestTitle: `feature: handle release ${releasedRepo}@${options.tagName}`,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return createMigrationResult({
      branchName: '',
      changedFiles: [],
      commitMessage: '',
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `feature: handle release ${options.repositoryName}@${options.tagName}`,
      status: 'error',
    })
  }
}
