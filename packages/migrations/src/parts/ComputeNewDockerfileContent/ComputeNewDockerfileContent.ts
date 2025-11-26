import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface ComputeNewDockerfileContentParams {
  currentContent: string
  newVersion: string
}

export interface ComputeNewDockerfileContentResult {
  newContent: string
}

const computeNewDockerfileContentCore = (
  currentContent: string,
  newVersion: string,
): ComputeNewDockerfileContentResult => {
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v')
    ? newVersion.slice(1)
    : newVersion
  const updated = currentContent.replaceAll(
    /node:\d+\.\d+\.\d+/g,
    `node:${versionWithoutPrefix}`,
  )
  return {
    newContent: updated,
  }
}

export interface ComputeNewDockerfileContentOptions extends BaseMigrationOptions {
  currentContent: string
  newVersion: string
}

export const computeNewDockerfileContent = async (
  options: ComputeNewDockerfileContentOptions,
): Promise<MigrationResult> => {
  try {
    const { currentContent, newVersion } = options
    const result = computeNewDockerfileContentCore(currentContent, newVersion)

    const hasChanges = currentContent !== result.newContent
    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    return {
      status: 'success',
      changedFiles: hasChanges
        ? [
            {
              path: 'Dockerfile',
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
      errorCode: 'COMPUTE_DOCKERFILE_CONTENT_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
