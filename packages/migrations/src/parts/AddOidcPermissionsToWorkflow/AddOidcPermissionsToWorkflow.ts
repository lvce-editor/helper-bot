import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
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
  // Check if there's already a blank line before jobs - if so, we'll use it as separator
  const hasBlankLineBefore = jobsIndex > 0 && lines[jobsIndex - 1].trim() === ''
  const insertIndex = hasBlankLineBefore ? jobsIndex - 1 : jobsIndex
  const newLines = [
    ...lines.slice(0, insertIndex),
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
    const workflowPath = new URL('.github/workflows/release.yml', options.clonedRepoUri).toString()

    const fileExists = await options.fs.exists(workflowPath)
    if (!fileExists) {
      return emptyMigrationResult
    }

    const originalContent = await options.fs.readFile(workflowPath, 'utf8')
    const updatedContent = addOidcPermissionsToWorkflowContent(originalContent)
    const hasChanges = originalContent !== updatedContent
    const pullRequestTitle = 'feature: update permissions for open id connect publishing'

    if (!hasChanges) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/add-oidc-permissions-to-workflow',
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
      errorCode: ERROR_CODES.ADD_OIDC_PERMISSIONS_FAILED,
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
