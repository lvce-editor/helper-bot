import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const computeEnsureLernaExcludedContentCore = (currentContent: Readonly<string>): { newContent: string; hasChanges: boolean } => {
  // Check if the script contains any ncu commands
  const ncuRegex = /OUTPUT=`ncu -u(.*?)`/g
  const matches = [...currentContent.matchAll(ncuRegex)]

  if (matches.length === 0) {
    return {
      hasChanges: false,
      newContent: currentContent,
    }
  }

  let updatedContent = currentContent
  let hasChanges = false

  // Process each ncu command
  for (const match of matches) {
    const ncuCommand = match[1]

    // Check if lerna is already excluded
    if (!ncuCommand.includes('-x lerna')) {
      // Add lerna to the exclusion list
      let updatedCommand: string
      if (ncuCommand.trim() === '') {
        // No existing exclusions
        updatedCommand = ' -x lerna'
      } else {
        // Has existing exclusions, add lerna to the end
        updatedCommand = ncuCommand.replace(/(-x [^-]+)+$/, (match) => `${match} -x lerna`)
      }

      updatedContent = updatedContent.replace(match[0], `OUTPUT=\`ncu -u${updatedCommand}\``)
      hasChanges = true
    }
  }

  return {
    hasChanges,
    newContent: updatedContent,
  }
}

export type ComputeEnsureLernaExcludedContentOptions = BaseMigrationOptions

export const computeEnsureLernaExcludedContent = async (options: Readonly<ComputeEnsureLernaExcludedContentOptions>): Promise<MigrationResult> => {
  try {
    const scriptPath = new URL('scripts/update-dependencies.sh', options.clonedRepoUri).toString()

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(scriptPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const result = computeEnsureLernaExcludedContentCore(currentContent)
    const pullRequestTitle = 'ci: ensure lerna is excluded from ncu commands'

    if (!result.hasChanges) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/ensure-lerna-excluded',
      changedFiles: [
        {
          content: result.newContent,
          path: 'scripts/update-dependencies.sh',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.COMPUTE_ENSURE_LERNA_EXCLUDED_FAILED,
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
