import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'

const computeNewDockerfileContentCore = (
  currentContent: string,
  newVersion: string,
): string => {
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v')
    ? newVersion.slice(1)
    : newVersion
  return currentContent.replaceAll(
    /node:\d+\.\d+\.\d+/g,
    `node:${versionWithoutPrefix}`,
  )
}

export interface ComputeNewDockerfileContentOptions
  extends BaseMigrationOptions {}

export const computeNewDockerfileContent = async (
  options: ComputeNewDockerfileContentOptions,
): Promise<MigrationResult> => {
  try {
    const newVersion = await getLatestNodeVersion(options.fetch)
    const dockerfilePath = join(options.clonedRepoPath, 'Dockerfile')

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(dockerfilePath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return {
          status: 'success',
          changedFiles: [],
          pullRequestTitle: `ci: update Node.js to version ${newVersion}`,
        }
      }
      throw error
    }

    const newContent = computeNewDockerfileContentCore(
      currentContent,
      newVersion,
    )
    const hasChanges = currentContent !== newContent
    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    return {
      status: 'success',
      changedFiles: hasChanges
        ? [
            {
              path: 'Dockerfile',
              content: newContent,
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
