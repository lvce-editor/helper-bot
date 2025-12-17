import type {
  MigrationErrorResult,
  MigrationErrorResultWithoutStatusCode,
  MigrationResult,
  MigrationResultWithoutStatusCode,
  MigrationSuccessResult,
  MigrationSuccessResultWithoutStatusCode,
} from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'

export const getHttpStatusCode = (migrationResult: MigrationResultWithoutStatusCode): number => {
  if (migrationResult.status === 'error') {
    const errorResult: MigrationErrorResultWithoutStatusCode = migrationResult
    const statusCode = errorResult.errorCode === 'DEPENDENCY_NOT_FOUND' || errorResult.errorCode === 'FORBIDDEN' ? 400 : 424
    return statusCode
  }
  return 200
}

export const createMigrationResult = (result: MigrationResultWithoutStatusCode): MigrationResult => {
  const statusCode = getHttpStatusCode(result)
  if (result.status === 'error') {
    const errorResult: MigrationErrorResultWithoutStatusCode = result
    const migrationErrorResult: MigrationErrorResult = {
      errorCode: errorResult.errorCode,
      errorMessage: errorResult.errorMessage,
      status: 'error',
      statusCode,
    }
    return migrationErrorResult
  }
  const successResult: MigrationSuccessResultWithoutStatusCode = result
  const migrationSuccessResult: MigrationSuccessResult = {
    branchName: successResult.branchName,
    changedFiles: successResult.changedFiles,
    commitMessage: successResult.commitMessage,
    pullRequestTitle: successResult.pullRequestTitle,
    status: 'success',
    statusCode,
  }
  return migrationSuccessResult
}

export const emptyMigrationResult: MigrationSuccessResult = {
  branchName: '',
  changedFiles: [],
  commitMessage: '',
  pullRequestTitle: '',
  status: 'success',
  statusCode: 200,
}

export const createValidationErrorMigrationResult = (errorMessage: string, errorCode: string = ERROR_CODES.UPDATE_DEPENDENCIES_FAILED): MigrationResult => {
  return createMigrationResult({
    errorCode,
    errorMessage,
    status: 'error',
  })
}
