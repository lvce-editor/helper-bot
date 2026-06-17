import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { compareNodeVersions, getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

const computeNewNvmrcContentCore = (currentContent: Readonly<string>, newVersion: Readonly<string>): { newContent: string; shouldUpdate: boolean } => {
  try {
    if (compareNodeVersions(currentContent, newVersion) >= 0) {
      return {
        newContent: currentContent,
        shouldUpdate: false,
      }
    }
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  } catch {
    // If parsing fails, assume we should update
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  }
}

export type ComputeNewNvmrcContentOptions = BaseMigrationOptions

export const computeNewNvmrcContent = async (options: Readonly<ComputeNewNvmrcContentOptions>): Promise<MigrationResult> => {
  try {
    const newVersion = await getLatestNodeVersion(options.fetch)
    const nvmrcPath = resolveUri('.nvmrc', options.clonedRepoUri)

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(nvmrcPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const result = computeNewNvmrcContentCore(currentContent, newVersion)

    if (!result.shouldUpdate) {
      return emptyMigrationResult
    }

    const hasChanges = currentContent !== result.newContent

    if (!hasChanges) {
      return emptyMigrationResult
    }

    const pullRequestTitle = `feature: update Node.js to version ${newVersion}`

    return createMigrationResult({
      branchName: 'feature/update-node-version',
      changedFiles: [
        {
          content: result.newContent,
          path: '.nvmrc',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
    })
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.COMPUTE_NVMRC_CONTENT_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
