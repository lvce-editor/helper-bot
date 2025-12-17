import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const removeNpmTokenFromWorkflowContent = (content: Readonly<string>): string => {
  // Pattern to match the env section with NODE_AUTH_TOKEN
  // This matches: env: followed by newline, NODE_AUTH_TOKEN line, and the newline after it
  // We need to match the entire block including proper newlines
  const npmTokenPattern = /(\s*)env:\s*\n(\s*)NODE_AUTH_TOKEN:\s*\${{secrets\.NPM_TOKEN}}\s*\n/gm

  // Replace with a newline to maintain proper YAML structure
  return content.replaceAll(npmTokenPattern, '\n')
}

export type RemoveNpmTokenFromWorkflowOptions = BaseMigrationOptions

export const removeNpmTokenFromWorkflow = async (options: Readonly<RemoveNpmTokenFromWorkflowOptions>): Promise<MigrationResult> => {
  try {
    const workflowPath = new URL('.github/workflows/release.yml', options.clonedRepoUri).toString()

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
      statusCode: 200,
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
