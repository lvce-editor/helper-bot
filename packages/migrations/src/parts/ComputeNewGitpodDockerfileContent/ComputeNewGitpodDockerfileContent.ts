import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { compareNodeVersions, getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

const computeNewGitpodDockerfileContentCore = (currentContent: Readonly<string>, newVersion: Readonly<string>): string => {
  const versionWithoutPrefix = newVersion.startsWith('v') ? newVersion.slice(1) : newVersion
<<<<<<< HEAD
  return currentContent.replaceAll(/(nvm [\w\s]+) \d+\.\d+\.\d+/g, (_match, command: string) => `${command} ${versionWithoutPrefix}`)
=======
  return currentContent.replaceAll(/(nvm [\w\s]+) (\d+\.\d+\.\d+)/g, (match, command: string, currentVersion: string) => {
    if (compareNodeVersions(currentVersion, newVersion) >= 0) {
      return match
    }
    return `${command} ${versionWithoutPrefix}`
  })
>>>>>>> origin/main
}

export type ComputeNewGitpodDockerfileContentOptions = BaseMigrationOptions

export const computeNewGitpodDockerfileContent = async (options: Readonly<ComputeNewGitpodDockerfileContentOptions>): Promise<MigrationResult> => {
  try {
    const newVersion = await getLatestNodeVersion(options.fetch)
    const gitpodDockerfilePath = resolveUri('.gitpod.Dockerfile', options.clonedRepoUri)

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

    if (!hasChanges) {
      return emptyMigrationResult
    }

    const pullRequestTitle = `ci: update Node.js to version ${newVersion}`

    return createMigrationResult({
      branchName: 'feature/update-node-version',
      changedFiles: [
        {
          content: newContent,
          path: '.gitpod.Dockerfile',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
    })
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.COMPUTE_GITPOD_DOCKERFILE_CONTENT_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
