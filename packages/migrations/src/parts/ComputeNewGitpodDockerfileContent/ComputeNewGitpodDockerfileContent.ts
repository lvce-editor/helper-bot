import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
<<<<<<< HEAD
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
        return emptyMigrationResult
=======
        return {
          changedFiles: [],
          pullRequestTitle: `ci: update Node.js to version ${newVersion}`,
          status: 'success',
          statusCode: 200,
        }
>>>>>>> origin/main
      }
      throw error
    }

    const newContent = computeNewGitpodDockerfileContentCore(currentContent, newVersion)
    const hasChanges = currentContent !== newContent
    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

<<<<<<< HEAD
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
=======
    return {
      changedFiles: hasChanges
        ? [
            {
              content: newContent,
              path: '.gitpod.Dockerfile',
            },
          ]
        : [],
>>>>>>> origin/main
      pullRequestTitle,
      status: 'success',
      statusCode: 200,
    }
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
