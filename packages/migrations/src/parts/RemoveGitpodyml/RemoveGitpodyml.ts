import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type RemoveGitpodymlOptions = BaseMigrationOptions

export const removeGitpodyml = async (options: Readonly<RemoveGitpodymlOptions>): Promise<MigrationResult> => {
  try {
    const gitpodYmlPath = new URL('.gitpod.yml', options.clonedRepoUri).toString()
    const gitpodDockerfilePath = new URL('.gitpod.Dockerfile', options.clonedRepoUri).toString()

    const ymlExists = await options.fs.exists(gitpodYmlPath)
    const dockerfileExists = await options.fs.exists(gitpodDockerfilePath)

    if (!ymlExists && !dockerfileExists) {
      return emptyMigrationResult
    }

    const changedFiles = []
    if (ymlExists) {
      changedFiles.push({
        content: '',
        path: '.gitpod.yml',
        type: 'deleted' as const,
      })
    }
    if (dockerfileExists) {
      changedFiles.push({
        content: '',
        path: '.gitpod.Dockerfile',
        type: 'deleted' as const,
      })
    }

    const pullRequestTitle =
      ymlExists && dockerfileExists
        ? 'ci: remove .gitpod.yml and .gitpod.Dockerfile'
        : (ymlExists ? 'ci: remove .gitpod.yml' : 'ci: remove .gitpod.Dockerfile')

    return {
      branchName: 'feature/remove-gitpod-yml',
      changedFiles,
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.REMOVE_GITPOD_YML_FAILED,
      errorMessage: stringifyError(error),
      status: 'error' as const,
    }
    return {
      changedFiles: [],
      errorCode: errorResult.errorCode,
      errorMessage: errorResult.errorMessage,
      status: 'error',
      statusCode: getHttpStatusCode(errorResult),
    }
  }
}
