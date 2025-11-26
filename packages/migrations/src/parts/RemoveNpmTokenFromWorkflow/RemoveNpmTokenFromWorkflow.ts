import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface RemoveNpmTokenFromWorkflowParams {
  content: string
}

export interface RemoveNpmTokenFromWorkflowResult {
  updatedContent: string
}

const removeNpmTokenFromWorkflowContent = (
  content: string,
): RemoveNpmTokenFromWorkflowResult => {
  // Pattern to match the env section with NODE_AUTH_TOKEN
  // This matches the exact pattern: env: followed by NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
  const npmTokenPattern =
    /^\s*env:\s*\n\s*NODE_AUTH_TOKEN:\s*\${{secrets\.NPM_TOKEN}}\s*$/gm

  const updatedContent = content.replace(npmTokenPattern, '')

  return {
    updatedContent,
  }
}

export interface RemoveNpmTokenFromWorkflowOptions extends BaseMigrationOptions {
  content: string
}

export const removeNpmTokenFromWorkflow = async (
  options: RemoveNpmTokenFromWorkflowOptions,
): Promise<MigrationResult> => {
  try {
    const { content } = options
    const result = removeNpmTokenFromWorkflowContent(content)

    const hasChanges = content !== result.updatedContent
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
          content: result.updatedContent,
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
  }
}
