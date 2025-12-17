import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

const removeNpmTokenFromWorkflowContent = (content: Readonly<string>): string => {
  // Pattern to match the env section with NODE_AUTH_TOKEN
  // This matches the exact pattern: env: followed by NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
  const npmTokenPattern = /^\s*env:\s*\n\s*NODE_AUTH_TOKEN:\s*\${{secrets\.NPM_TOKEN}}\s*$/gm

  return content.replaceAll(npmTokenPattern, '')
}

export type RemoveNpmTokenFromWorkflowOptions = BaseMigrationOptions

export const removeNpmTokenFromWorkflow = async (options: Readonly<RemoveNpmTokenFromWorkflowOptions>): Promise<MigrationResult> => {
  try {
    const workflowPath = join(options.clonedRepoPath, '.github/workflows/release.yml')

    let originalContent: string
    try {
      originalContent = await options.fs.readFile(workflowPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return createMigrationResult({
          status: 'success',
          changedFiles: [],
          pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
        })
      }
      throw error
    }

    const updatedContent = removeNpmTokenFromWorkflowContent(originalContent)
    const hasChanges = originalContent !== updatedContent
    const pullRequestTitle = 'ci: remove NODE_AUTH_TOKEN from release workflow'

    if (!hasChanges) {
      return createMigrationResult({
        status: 'success',
        changedFiles: [],
        pullRequestTitle,
      })
    }

    return createMigrationResult({
      status: 'success',
      changedFiles: [
        {
          path: '.github/workflows/release.yml',
          content: updatedContent,
        },
      ],
      pullRequestTitle,
    })
  } catch (error) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
      errorCode: ERROR_CODES.REMOVE_NPM_TOKEN_FAILED,
      errorMessage: stringifyError(error),
    })
  }
}
