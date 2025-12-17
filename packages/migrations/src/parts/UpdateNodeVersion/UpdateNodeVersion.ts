import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type UpdateNodeVersionOptions = BaseMigrationOptions

export const updateNodeVersion = async (options: Readonly<UpdateNodeVersionOptions>): Promise<MigrationResult> => {
  try {
    // Call all three RPC functions in parallel
    const [nvmrcResult, dockerfileResult] = await Promise.all([computeNewNvmrcContent(options), computeNewDockerfileContent(options)])

    // Check for errors
    if (nvmrcResult.status === 'error') {
      return createMigrationResult({
        errorCode: ERROR_CODES.COMPUTE_NVMRC_CONTENT_FAILED,
        errorMessage: nvmrcResult.errorMessage || 'Failed to compute .nvmrc content',
        status: 'error',
      })
    }
    if (dockerfileResult.status === 'error') {
      return createMigrationResult({
        errorCode: ERROR_CODES.COMPUTE_DOCKERFILE_CONTENT_FAILED,
        errorMessage: dockerfileResult.errorMessage || 'Failed to compute Dockerfile content',
        status: 'error',
      })
    }

    // Combine all changed files
    const allChangedFiles = [...nvmrcResult.changedFiles, ...dockerfileResult.changedFiles]

    if (allChangedFiles.length === 0) {
      return emptyMigrationResult
    }

    // Use the pull request title from any of the results (they should all be the same)
    return {
      branchName: 'feature/update-node-version',
      changedFiles: allChangedFiles,
      commitMessage: nvmrcResult.pullRequestTitle,
      pullRequestTitle: nvmrcResult.pullRequestTitle,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.COMPUTE_NVMRC_CONTENT_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
