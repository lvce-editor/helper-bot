import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
<<<<<<< HEAD
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
=======
>>>>>>> origin/main

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
    const nvmrcPath = join(options.clonedRepoPath, '.nvmrc')

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(nvmrcPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
<<<<<<< HEAD
        return emptyMigrationResult
=======
        return {
          changedFiles: [],
          pullRequestTitle: `ci: update Node.js to version ${newVersion}`,
          status: 'success',
          statusCode: 200,
        }
>>>>>>> origin/main
      }
      throw error
    }

    const result = computeNewNvmrcContentCore(currentContent, newVersion)
    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    if (!result.shouldUpdate) {
<<<<<<< HEAD
      return emptyMigrationResult
=======
      return {
        changedFiles: [],
        pullRequestTitle,
        status: 'success',
        statusCode: 200,
      }
>>>>>>> origin/main
    }

    const hasChanges = currentContent !== result.newContent

<<<<<<< HEAD
    if (!hasChanges) {
      return emptyMigrationResult
    }

    return createMigrationResult({
      status: 'success',
      changedFiles: [
        {
          path: '.nvmrc',
          content: result.newContent,
        },
      ],
=======
    return {
      changedFiles: hasChanges
        ? [
            {
              content: result.newContent,
              path: '.nvmrc',
            },
          ]
        : [],
>>>>>>> origin/main
      pullRequestTitle,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.COMPUTE_NVMRC_CONTENT_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `ci: update Node.js version`,
      status: 'error',
    })
  }
}
