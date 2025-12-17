import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

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
        return createMigrationResult({
          status: 'success',
          changedFiles: [],
          pullRequestTitle: 'feature: update permissions for open id connect publishing',
        })
      }
      throw error
    }

    const updatedContent = addOidcPermissionsToWorkflowContent(originalContent)
    const hasChanges = originalContent !== updatedContent
    const pullRequestTitle = 'feature: update permissions for open id connect publishing'

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
      pullRequestTitle: 'feature: update permissions for open id connect publishing',
      errorCode: ERROR_CODES.ADD_OIDC_PERMISSIONS_FAILED,
      errorMessage: stringifyError(error),
    })
  }
}
