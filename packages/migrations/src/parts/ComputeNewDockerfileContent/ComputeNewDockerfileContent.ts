import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { compareNodeVersions, getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

const computeNewDockerfileContentCore = (currentContent: Readonly<string>, newVersion: Readonly<string>): string => {
  const versionWithoutPrefix = newVersion.startsWith('v') ? newVersion.slice(1) : newVersion
<<<<<<< HEAD
  return currentContent.replaceAll(/node:\d+\.\d+\.\d+/g, () => `node:${versionWithoutPrefix}`)
=======
  return currentContent.replaceAll(/node:(\d+\.\d+\.\d+)/g, (match, currentVersion: string) => {
    if (compareNodeVersions(currentVersion, newVersion) >= 0) {
      return match
    }
    return `node:${versionWithoutPrefix}`
  })
>>>>>>> origin/main
}

export type ComputeNewDockerfileContentOptions = BaseMigrationOptions

export const computeNewDockerfileContent = async (options: Readonly<ComputeNewDockerfileContentOptions>): Promise<MigrationResult> => {
  try {
    const newVersion = await getLatestNodeVersion(options.fetch)
    const dockerfilePath = resolveUri('Dockerfile', options.clonedRepoUri)

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

    if (!hasChanges) {
      return emptyMigrationResult
    }

    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    return createMigrationResult({
      branchName: 'feature/update-node-version',
      changedFiles: [
        {
          content: newContent,
          path: 'Dockerfile',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
    })
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.COMPUTE_DOCKERFILE_CONTENT_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
