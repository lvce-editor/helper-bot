import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import { getLatestNodeVersion } from '../GetLatestNodeVersion/GetLatestNodeVersion.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

const computeNewGitpodDockerfileContentCore = (
  currentContent: string,
  newVersion: string,
): string => {
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v')
    ? newVersion.slice(1)
    : newVersion
  return currentContent.replaceAll(
    /(nvm [\w\s]+) \d+\.\d+\.\d+/g,
    `$1 ${versionWithoutPrefix}`,
  )
}

export interface ComputeNewGitpodDockerfileContentOptions
  extends BaseMigrationOptions {}

export const computeNewGitpodDockerfileContent = async (
  options: ComputeNewGitpodDockerfileContentOptions,
): Promise<MigrationResult> => {
  const clonedRepo = await cloneRepositoryTmp(
    options.repositoryOwner,
    options.repositoryName,
  )
  try {
    const newVersion = await getLatestNodeVersion()
    const gitpodDockerfilePath = join(clonedRepo.path, '.gitpod.Dockerfile')

    let currentContent: string
    try {
      currentContent = await readFile(gitpodDockerfilePath, 'utf8')
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

    const newContent = computeNewGitpodDockerfileContentCore(
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
              path: '.gitpod.Dockerfile',
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
      errorCode: 'COMPUTE_GITPOD_DOCKERFILE_CONTENT_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await clonedRepo[Symbol.asyncDispose]()
  }
}
