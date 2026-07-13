import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, createValidationErrorMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { normalizePath, resolveUri } from '../UriUtils/UriUtils.ts'

const builtinExtensionsPath = 'packages/build/src/parts/DownloadBuiltinExtensions/builtinExtensions.json'

export interface BuiltinExtensionUpdate {
  readonly repositoryName: string
  readonly tagName: string
}

export interface UpdateBuiltinExtensionsBatchOptions extends BaseMigrationOptions {
  readonly updates: readonly BuiltinExtensionUpdate[]
}

const validateOptions = (options: Readonly<UpdateBuiltinExtensionsBatchOptions>): string | undefined => {
  if (!Array.isArray(options.updates) || options.updates.length === 0) {
    return 'Invalid or missing updates parameter'
  }
  for (const update of options.updates) {
    if (!update.repositoryName || typeof update.repositoryName !== 'string') {
      return 'Invalid or missing repositoryName parameter'
    }
    if (!update.tagName || typeof update.tagName !== 'string') {
      return 'Invalid or missing tagName parameter'
    }
  }
  return undefined
}

export const updateBuiltinExtensionsBatch = async (options: Readonly<UpdateBuiltinExtensionsBatchOptions>): Promise<MigrationResult> => {
  try {
    const validationError = validateOptions(options)
    if (validationError) {
      return createValidationErrorMigrationResult(validationError)
    }

    const filePath = resolveUri(builtinExtensionsPath, options.clonedRepoUri)
    let currentContent: string
    try {
      currentContent = await options.fs.readFile(filePath, 'utf8')
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const versions = new Map(options.updates.map((update) => [`builtin.${update.repositoryName}`, update.tagName.replace('v', '')]))
    const builtinExtensions = JSON.parse(currentContent).map((extension: any) => {
      const version = versions.get(extension.name)
      return version && version !== extension.version ? { ...extension, version } : extension
    })
    const newContent = stringifyJson(builtinExtensions)
    if (newContent === currentContent) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/update-builtin-extensions',
      changedFiles: [{ content: newContent, path: normalizePath(builtinExtensionsPath) }],
      commitMessage: 'feature: update builtin extensions',
      pullRequestTitle: 'feature: update builtin extensions',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
