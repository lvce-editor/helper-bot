import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const computeNewDockerfileContentCore = (currentContent: Readonly<string>, newVersion: Readonly<string>): string => {
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v') ? newVersion.slice(1) : newVersion
  return currentContent.replaceAll(/node:\d+\.\d+\.\d+/g, `node:${versionWithoutPrefix}`)
}

export type ComputeNewDockerfileContentOptions = BaseMigrationOptions

export const computeNewDockerfileContent = async (options: Readonly<ComputeNewDockerfileContentOptions>): Promise<MigrationResult> => {
  try {
    const newVersion = await getLatestNodeVersion(options.fetch)
    const dockerfilePath = join(options.clonedRepoPath, 'Dockerfile')

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(dockerfilePath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const newContent = computeNewDockerfileContentCore(currentContent, newVersion)
    const hasChanges = currentContent !== newContent
    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    if (!hasChanges) {
      return emptyMigrationResult
    }

    return createMigrationResult({
      changedFiles: [
        {
          content: newContent,
          path: 'Dockerfile',
        },
      ],
      pullRequestTitle,
      status: 'success',
      branchName: 'feature/update-node-version',
      commitMessage: pullRequestTitle,
    })
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.COMPUTE_DOCKERFILE_CONTENT_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `ci: update Node.js version`,
      status: 'error',
      branchName: '',
      commitMessage: '',
    })
  }
}
