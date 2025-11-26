import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface AddOidcPermissionsToWorkflowParams {
  content: string
}

export interface AddOidcPermissionsToWorkflowResult {
  updatedContent: string
}

const addOidcPermissionsToWorkflowContent = (
  content: string,
): AddOidcPermissionsToWorkflowResult => {
  // Check if permissions section already exists
  if (content.includes('permissions:')) {
    return {
      updatedContent: content,
    }
  }

  // Find the jobs section and add permissions before it
  const lines = content.split('\n')
  const jobsIndex = lines.findIndex((line) => line.trim().startsWith('jobs:'))

  if (jobsIndex === -1) {
    // If no jobs section found, add permissions at the end of the file
    lines.push('')
    lines.push('permissions:')
    lines.push('  id-token: write # Required for OIDC')
    lines.push('  contents: write')
    return {
      updatedContent: lines.join('\n'),
    }
  }

  // Insert permissions before the jobs section
  const newLines = [
    ...lines.slice(0, jobsIndex),
    '',
    'permissions:',
    '  id-token: write # Required for OIDC',
    '  contents: write',
    '',
    ...lines.slice(jobsIndex),
  ]

  return {
    updatedContent: newLines.join('\n'),
  }
}

export interface AddOidcPermissionsToWorkflowOptions extends BaseMigrationOptions {
  content: string
}

export const addOidcPermissionsToWorkflow = async (
  options: AddOidcPermissionsToWorkflowOptions,
): Promise<MigrationResult> => {
  try {
    const { content } = options
    const result = addOidcPermissionsToWorkflowContent(content)

    const hasChanges = content !== result.updatedContent
    const pullRequestTitle = 'feature: update permissions for open id connect publishing'

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
      pullRequestTitle: 'feature: update permissions for open id connect publishing',
      errorCode: 'ADD_OIDC_PERMISSIONS_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
