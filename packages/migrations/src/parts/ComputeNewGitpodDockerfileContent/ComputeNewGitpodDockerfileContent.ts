import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const computeNewGitpodDockerfileContentCore = (currentContent: Readonly<string>, newVersion: Readonly<string>): string => {
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v') ? newVersion.slice(1) : newVersion
  return currentContent.replaceAll(/(nvm [\w\s]+) \d+\.\d+\.\d+/g, `$1 ${versionWithoutPrefix}`)
}

export type ComputeNewGitpodDockerfileContentOptions = BaseMigrationOptions

export const computeNewGitpodDockerfileContent = async (options: Readonly<ComputeNewGitpodDockerfileContentOptions>): Promise<MigrationResult> => {
  try {
    const newVersion = await getLatestNodeVersion(options.fetch)
    const gitpodDockerfilePath = join(options.clonedRepoPath, '.gitpod.Dockerfile')

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(gitpodDockerfilePath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const newContent = computeNewGitpodDockerfileContentCore(currentContent, newVersion)
    const hasChanges = currentContent !== newContent
    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    if (!hasChanges) {
      return emptyMigrationResult
    }

    return createMigrationResult({
      status: 'success',
      changedFiles: [
        {
          path: '.gitpod.Dockerfile',
          content: newContent,
        },
      ],
      pullRequestTitle,
    })
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.COMPUTE_GITPOD_DOCKERFILE_CONTENT_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `ci: update Node.js version`,
      status: 'error',
    })
  }
}
