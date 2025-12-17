import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const addOidcPermissionsToWorkflowContent = (content: Readonly<string>): string => {
  // Check if permissions section already exists
  if (content.includes('permissions:')) {
    return content
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
    return lines.join('\n')
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

  return newLines.join('\n')
}

export type AddOidcPermissionsToWorkflowOptions = BaseMigrationOptions

export const addOidcPermissionsToWorkflow = async (options: Readonly<AddOidcPermissionsToWorkflowOptions>): Promise<MigrationResult> => {
  try {
    const workflowPath = join(options.clonedRepoPath, '.github/workflows/release.yml')

    let originalContent: string
    try {
      originalContent = await options.fs.readFile(workflowPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const updatedContent = addOidcPermissionsToWorkflowContent(originalContent)
    const hasChanges = originalContent !== updatedContent
    const pullRequestTitle = 'feature: update permissions for open id connect publishing'

    if (!hasChanges) {
      return emptyMigrationResult
    }

    return {
      changedFiles: [
        {
          content: updatedContent,
          path: '.github/workflows/release.yml',
        },
      ],
      pullRequestTitle,
      status: 'success',
      statusCode: 200,
      branchName: 'feature/add-oidc-permissions-to-workflow',
      commitMessage: pullRequestTitle,
    }
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.ADD_OIDC_PERMISSIONS_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: 'feature: update permissions for open id connect publishing',
      status: 'error',
      branchName: '',
      commitMessage: '',
    })
  }
}
