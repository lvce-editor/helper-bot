import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface ComputeNewNvmrcContentParams {
  currentContent: string
  newVersion: string
}

export interface ComputeNewNvmrcContentResult {
  newContent: string
  shouldUpdate: boolean
}

const parseVersion = (content: string): number => {
  const trimmed = content.trim()
  if (trimmed.startsWith('v')) {
    return parseInt(trimmed.slice(1))
  }
  return parseInt(trimmed)
}

const computeNewNvmrcContentCore = (
  currentContent: string,
  newVersion: string,
): ComputeNewNvmrcContentResult => {
  try {
    const existingVersionNumber = parseVersion(currentContent)
    const newVersionNumber = parseVersion(newVersion)
    if (existingVersionNumber > newVersionNumber) {
      return {
        newContent: currentContent,
        shouldUpdate: false,
      }
    }
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  } catch (error) {
    // If parsing fails, assume we should update
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  }
}

export interface ComputeNewNvmrcContentOptions extends BaseMigrationOptions {
  currentContent: string
  newVersion: string
}

export const computeNewNvmrcContent = async (
  options: ComputeNewNvmrcContentOptions,
): Promise<MigrationResult> => {
  try {
    const { currentContent, newVersion } = options
    const result = computeNewNvmrcContentCore(currentContent, newVersion)

    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    if (!result.shouldUpdate) {
      return {
        status: 'success',
        changedFiles: [],
        pullRequestTitle,
      }
    }

    const hasChanges = currentContent !== result.newContent

    return {
      status: 'success',
      changedFiles: hasChanges
        ? [
            {
              path: '.nvmrc',
              content: result.newContent,
            },
          ]
        : [],
      pullRequestTitle,
    }
  } catch (error) {
    return {
      status: 'error',
      changedFiles: [],
      pullRequestTitle: `ci: update Node.js version`,
      errorCode: 'COMPUTE_NVMRC_CONTENT_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
