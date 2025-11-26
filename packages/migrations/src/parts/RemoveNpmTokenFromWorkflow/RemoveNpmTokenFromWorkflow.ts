import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

const removeNpmTokenFromWorkflowContent = (content: string): string => {
  // Pattern to match the env section with NODE_AUTH_TOKEN
  // This matches the exact pattern: env: followed by NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
  const npmTokenPattern =
    /^\s*env:\s*\n\s*NODE_AUTH_TOKEN:\s*\${{secrets\.NPM_TOKEN}}\s*$/gm

  return content.replace(npmTokenPattern, '')
}

export interface RemoveNpmTokenFromWorkflowOptions
  extends BaseMigrationOptions {}

export const removeNpmTokenFromWorkflow = async (
  options: RemoveNpmTokenFromWorkflowOptions,
): Promise<MigrationResult> => {
  const clonedRepo = await cloneRepositoryTmp(
    options.repositoryOwner,
    options.repositoryName,
  )
  try {
    const workflowPath = join(
      clonedRepo.path,
      '.github/workflows/release.yml',
    )

    let originalContent: string
    try {
      originalContent = await readFile(workflowPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return {
          status: 'success',
          changedFiles: [],
          pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
        }
      }
      throw error
    }

    const updatedContent = removeNpmTokenFromWorkflowContent(originalContent)
    const hasChanges = originalContent !== updatedContent
    const pullRequestTitle = 'ci: remove NODE_AUTH_TOKEN from release workflow'

    if (!hasChanges) {
      return {
        status: 'success',
        changedFiles: [],
        pullRequestTitle,
      }
    }

    return {
      status: 'success',
      changedFiles: [
        {
          path: '.github/workflows/release.yml',
          content: updatedContent,
        },
      ],
      pullRequestTitle,
    }
  } catch (error) {
    return {
      status: 'error',
      changedFiles: [],
      pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
      errorCode: 'REMOVE_NPM_TOKEN_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await clonedRepo[Symbol.asyncDispose]()
  }
}
