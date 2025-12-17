import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const getNewValue = (value: readonly any[], repoName: string, version: string): any[] => {
  return value.map((item) => {
    if (item.name === `builtin.${repoName}`) {
      return {
        ...item,
        version,
      }
    }
    return item
  })
}

export interface UpdateBuiltinExtensionsOptions extends BaseMigrationOptions {
  releasedRepositoryName: string
  tagName: string
  targetFilePath: string
}

export const updateBuiltinExtensions = async (options: Readonly<UpdateBuiltinExtensionsOptions>): Promise<MigrationResult> => {
  try {
    const releasedRepo = options.releasedRepositoryName
    if (releasedRepo === 'renderer-process') {
      return emptyMigrationResult
    }

    const version = options.tagName.replace('v', '')

    // Read the builtinExtensions.json file from the cloned target repo
    const filePath = join(options.clonedRepoPath, options.targetFilePath)

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(filePath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const filesJsonValue = JSON.parse(currentContent)
    const filesJsonValueNew = getNewValue(filesJsonValue, releasedRepo, version)
    const filesJsonStringNew = JSON.stringify(filesJsonValueNew, null, 2) + '\n'

    if (currentContent === filesJsonStringNew) {
      return emptyMigrationResult
    }

    return {
      changedFiles: [
        {
          content: filesJsonStringNew,
          path: options.targetFilePath,
        },
      ],
      pullRequestTitle: `feature: update ${releasedRepo} to version ${options.tagName}`,
      status: 'success',
      statusCode: 200,
      branchName: `feature/update-${releasedRepo}-to-${options.tagName}`,
      commitMessage: `feature: update ${releasedRepo} to version ${options.tagName}`,
    }
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `feature: update ${options.repositoryName} to version ${options.tagName}`,
      status: 'error',
      branchName: '',
      commitMessage: '',
    })
  }
}
