import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

export type RemoveGitpodOptions = BaseMigrationOptions

const gitpodFiles = ['.gitpod.yml', '.gitpod.Dockerfile'] as const

const removeGitpodReadmeContent = (content: string): string => {
  const withoutSections = content.replaceAll(/(?:^|\n)#{1,6}\s*[Gg]itpod[\s\S]*?(?=\n#{1,6}\s|$)/g, '')
  const withoutGitpodLines = withoutSections
    .split('\n')
    .filter((line) => !/gitpod/i.test(line))
    .join('\n')
  if (withoutGitpodLines === content) {
    return content
  }
  return withoutGitpodLines
    .replaceAll(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .trimEnd()
}

const getDeletedFiles = async (options: Readonly<RemoveGitpodOptions>): Promise<ChangedFile[]> => {
  const changedFiles: ChangedFile[] = []

  for (const path of gitpodFiles) {
    const fullPath = resolveUri(path, options.clonedRepoUri)
    const exists = await options.fs.exists(fullPath)
    if (exists) {
      changedFiles.push({
        content: '',
        path,
        type: 'deleted',
      })
    }
  }

  return changedFiles
}

const getReadmeChange = async (options: Readonly<RemoveGitpodOptions>): Promise<ChangedFile | undefined> => {
  const path = 'README.md'
  const fullPath = resolveUri(path, options.clonedRepoUri)

  let content: string
  try {
    content = await options.fs.readFile(fullPath, 'utf8')
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }

  const updatedContent = removeGitpodReadmeContent(content)
  if (updatedContent === content) {
    return undefined
  }

  return {
    content: updatedContent,
    path,
  }
}

export const removeGitpod = async (options: Readonly<RemoveGitpodOptions>): Promise<MigrationResult> => {
  try {
    const changedFiles = await getDeletedFiles(options)
    const readmeChange = await getReadmeChange(options)
    if (readmeChange) {
      changedFiles.push(readmeChange)
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    const pullRequestTitle = 'ci: remove Gitpod configuration'

    return {
      branchName: 'feature/remove-gitpod',
      changedFiles,
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.REMOVE_GITPOD_FAILED,
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
