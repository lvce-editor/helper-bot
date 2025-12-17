import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewGitpodDockerfileContent } from '../ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export type UpdateNodeVersionOptions = BaseMigrationOptions

export const updateNodeVersion = async (options: Readonly<UpdateNodeVersionOptions>): Promise<MigrationResult> => {
  try {
    // Call all three RPC functions in parallel
    const [nvmrcResult, dockerfileResult, gitpodResult] = await Promise.all([
      computeNewNvmrcContent(options),
      computeNewDockerfileContent(options),
      computeNewGitpodDockerfileContent(options),
    ])

    // Check for errors
    if (nvmrcResult.status === 'error') {
      return createMigrationResult({
        status: 'error',
        changedFiles: [],
        pullRequestTitle: 'ci: update Node.js version',
        errorCode: ERROR_CODES.COMPUTE_NVMRC_CONTENT_FAILED,
        errorMessage: nvmrcResult.errorMessage || 'Failed to compute .nvmrc content',
      })
    }
    if (dockerfileResult.status === 'error') {
      return createMigrationResult({
        status: 'error',
        changedFiles: [],
        pullRequestTitle: 'ci: update Node.js version',
        errorCode: ERROR_CODES.COMPUTE_DOCKERFILE_CONTENT_FAILED,
        errorMessage: dockerfileResult.errorMessage || 'Failed to compute Dockerfile content',
      })
    }
    if (gitpodResult.status === 'error') {
      return createMigrationResult({
        status: 'error',
        changedFiles: [],
        pullRequestTitle: 'ci: update Node.js version',
        errorCode: ERROR_CODES.COMPUTE_GITPOD_DOCKERFILE_CONTENT_FAILED,
        errorMessage: gitpodResult.errorMessage || 'Failed to compute .gitpod.Dockerfile content',
      })
    }

    // Combine all changed files
    const allChangedFiles = [...nvmrcResult.changedFiles, ...dockerfileResult.changedFiles, ...gitpodResult.changedFiles]

    if (allChangedFiles.length === 0) {
      return createMigrationResult({
        status: 'success',
        changedFiles: [],
        pullRequestTitle: nvmrcResult.pullRequestTitle,
      })
    }

    // Use the pull request title from any of the results (they should all be the same)
    return createMigrationResult({
      status: 'success',
      changedFiles: allChangedFiles,
      pullRequestTitle: nvmrcResult.pullRequestTitle,
    })
  } catch (error) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: 'ci: update Node.js version',
      errorCode: ERROR_CODES.COMPUTE_NVMRC_CONTENT_FAILED,
      errorMessage: stringifyError(error),
    })
  }
}
