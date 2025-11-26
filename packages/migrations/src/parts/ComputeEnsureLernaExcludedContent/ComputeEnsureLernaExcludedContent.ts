import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

const computeEnsureLernaExcludedContentCore = (
  currentContent: string,
): { newContent: string; hasChanges: boolean } => {
  // Check if the script contains any ncu commands
  const ncuRegex = /OUTPUT=`ncu -u(.*?)`/g
  const matches = [...currentContent.matchAll(ncuRegex)]

  if (matches.length === 0) {
    return {
      newContent: currentContent,
      hasChanges: false,
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
        updatedCommand = ncuCommand.replace(
          /(-x [^-]+)+$/,
          (match) => `${match} -x lerna`,
        )
      }

      updatedContent = updatedContent.replace(
        match[0],
        `OUTPUT=\`ncu -u${updatedCommand}\``,
      )
      hasChanges = true
    }
  }

  return {
    newContent: updatedContent,
    hasChanges,
  }
}

export type ComputeEnsureLernaExcludedContentOptions = BaseMigrationOptions

export const computeEnsureLernaExcludedContent = async (
  options: Readonly<ComputeEnsureLernaExcludedContentOptions>,
): Promise<MigrationResult> => {
  try {
    const scriptPath = join(
      options.clonedRepoPath,
      'scripts/update-dependencies.sh',
    )

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(scriptPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return {
          status: 'success',
          changedFiles: [],
          pullRequestTitle: 'ci: ensure lerna is excluded from ncu commands',
        }
      }
      throw error
    }

    const result = computeEnsureLernaExcludedContentCore(currentContent)
    const pullRequestTitle = 'ci: ensure lerna is excluded from ncu commands'

    if (!result.hasChanges) {
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
          path: 'scripts/update-dependencies.sh',
          content: result.newContent,
        },
      ],
      pullRequestTitle,
    }
  } catch (error) {
    return {
      status: 'error',
      changedFiles: [],
      pullRequestTitle: 'ci: ensure lerna is excluded from ncu commands',
      errorCode: 'COMPUTE_ENSURE_LERNA_EXCLUDED_FAILED',
      errorMessage:
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error),
    }
  }
}
