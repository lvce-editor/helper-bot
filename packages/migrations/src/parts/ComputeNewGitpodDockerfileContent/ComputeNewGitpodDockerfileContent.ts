import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface ComputeNewGitpodDockerfileContentParams {
  currentContent: string
  newVersion: string
}

export interface ComputeNewGitpodDockerfileContentResult {
  newContent: string
}

const computeNewGitpodDockerfileContentCore = (
  currentContent: string,
  newVersion: string,
): ComputeNewGitpodDockerfileContentResult => {
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v')
    ? newVersion.slice(1)
    : newVersion
  const updated = currentContent.replaceAll(
    /(nvm [\w\s]+) \d+\.\d+\.\d+/g,
    `$1 ${versionWithoutPrefix}`,
  )
  return {
    newContent: updated,
  }
}

export interface ComputeNewGitpodDockerfileContentOptions
  extends BaseMigrationOptions {
  currentContent: string
  newVersion: string
}

export const computeNewGitpodDockerfileContent = async (
  options: ComputeNewGitpodDockerfileContentOptions,
): Promise<MigrationResult> => {
  try {
    const { currentContent, newVersion } = options
    const result = computeNewGitpodDockerfileContentCore(
      currentContent,
      newVersion,
    )

    const hasChanges = currentContent !== result.newContent
    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    return {
      status: 'success',
      changedFiles: hasChanges
        ? [
            {
              path: '.gitpod.Dockerfile',
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
      errorCode: 'COMPUTE_GITPOD_DOCKERFILE_CONTENT_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
