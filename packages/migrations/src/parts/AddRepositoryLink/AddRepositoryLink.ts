import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

export type AddRepositoryLinkOptions = BaseMigrationOptions

const processExtensionJson = async (
  options: Readonly<AddRepositoryLinkOptions>,
  extensionJsonPath: string,
  relativePath: string,
): Promise<{ content: string; path: string } | null> => {
  const exists = await options.fs.exists(extensionJsonPath)
  if (!exists) {
    return null
  }

  const content = await options.fs.readFile(extensionJsonPath, 'utf8')
  const extensionJson = JSON.parse(content)

  // Check if repository property already exists
  if (extensionJson.repository) {
    return null
  }

  // Add repository property
  const repositoryUrl = `https://github.com/${options.repositoryOwner}/${options.repositoryName}`
  const updatedExtensionJson = {
    ...extensionJson,
    repository: repositoryUrl,
  }

  const updatedContent = stringifyJson(updatedExtensionJson)
  return {
    content: updatedContent,
    path: normalizePath(relativePath),
  }
}

export const addRepositoryLink = async (options: Readonly<AddRepositoryLinkOptions>): Promise<MigrationResult> => {
  try {
    const baseUri = options.clonedRepoUri.endsWith('/') ? options.clonedRepoUri : options.clonedRepoUri + '/'
    const changedFiles: Array<{ content: string; path: string }> = []

    // Check root level extension.json
    const rootExtensionJsonPath = new URL('extension.json', baseUri).toString()
    const rootResult = await processExtensionJson(options, rootExtensionJsonPath, 'extension.json')
    if (rootResult) {
      changedFiles.push(rootResult)
    }

    // Check packages/extension/extension.json (monorepo)
    const monorepoExtensionJsonPath = new URL('packages/extension/extension.json', baseUri).toString()
    const monorepoResult = await processExtensionJson(options, monorepoExtensionJsonPath, 'packages/extension/extension.json')
    if (monorepoResult) {
      changedFiles.push(monorepoResult)
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/add-repository-link',
      changedFiles,
      commitMessage: 'feature: add repository link to extension.json',
      pullRequestTitle: 'feature: add repository link to extension.json',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.ADD_REPOSITORY_LINK_FAILED,
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
