import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

const removeNpmTokenFromWorkflowContent = (content: Readonly<string>): string => {
  const lines = content.split('\n')
  const newLines: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]
    if (line.trim() === 'env:' && nextLine?.trim() === 'NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}') {
      i++
      continue
    }
    newLines.push(line)
  }
  return newLines.join('\n')
}

export type RemoveNpmTokenFromWorkflowOptions = BaseMigrationOptions

export const removeNpmTokenFromWorkflow = async (options: Readonly<RemoveNpmTokenFromWorkflowOptions>): Promise<MigrationResult> => {
  try {
    const workflowPath = resolveUri('.github/workflows/release.yml', options.clonedRepoUri)

    const fileExists = await options.fs.exists(workflowPath)
    if (!fileExists) {
      return emptyMigrationResult
    }

    const originalContent = await options.fs.readFile(workflowPath, 'utf8')
    const updatedContent = removeNpmTokenFromWorkflowContent(originalContent)
    const hasChanges = originalContent !== updatedContent

    if (!hasChanges) {
      return emptyMigrationResult
    }

    const pullRequestTitle = 'ci: remove NODE_AUTH_TOKEN from release workflow'

    return {
      branchName: 'feature/remove-npm-token-from-workflow',
      changedFiles: [
        {
          content: updatedContent,
          path: '.github/workflows/release.yml',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.REMOVE_NPM_TOKEN_FAILED,
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
