import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const parseVersion = (content: string): number => {
  const trimmed = content.trim()
  if (trimmed.startsWith('v')) {
    return Number.parseInt(trimmed.slice(1))
  }
  return Number.parseInt(trimmed)
}

const computeNewNvmrcContentCore = (currentContent: Readonly<string>, newVersion: Readonly<string>): { newContent: string; shouldUpdate: boolean } => {
  try {
    const existingVersionNumber = parseVersion(currentContent)
    const newVersionNumber = parseVersion(newVersion)
    if (existingVersionNumber > newVersionNumber) {
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
    const nvmrcPath = new URL('.nvmrc', options.clonedRepoUri).toString()

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
    const pullRequestTitle = `feature: update Node.js to version ${newVersion}`

    if (!result.shouldUpdate) {
      return emptyMigrationResult
    }

    const hasChanges = currentContent !== result.newContent

    if (!hasChanges) {
      return emptyMigrationResult
    }

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
