import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

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
    const filePath = new URL(options.targetFilePath, options.clonedRepoUri).toString()

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
    const filesJsonStringNew = stringifyJson(filesJsonValueNew)

    if (currentContent === filesJsonStringNew) {
      return emptyMigrationResult
    }

    return {
      branchName: `feature/update-${releasedRepo}-to-${options.tagName}`,
      changedFiles: [
        {
          content: filesJsonStringNew,
          path: normalizePath(options.targetFilePath),
        },
      ],
      commitMessage: `feature: update ${releasedRepo} to version ${options.tagName}`,
      pullRequestTitle: `feature: update ${releasedRepo} to version ${options.tagName}`,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      status: 'error' as const,
    }
    return {
      changedFiles: [],
      errorCode: errorResult.errorCode,
      errorMessage: errorResult.errorMessage,
      status: 'error',
      statusCode: getHttpStatusCode(errorResult),
    }
  }
}
