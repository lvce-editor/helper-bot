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
    const statusCode =
      errorResult.errorCode === 'DEPENDENCY_NOT_FOUND' || errorResult.errorCode === 'FORBIDDEN' || errorResult.errorCode === 'VALIDATION_ERROR' ? 400 : 424
    return statusCode
  }
  const successResult: MigrationSuccessResultWithoutStatusCode = migrationResult
  return successResult.changedFiles && successResult.changedFiles.length > 0 ? 201 : 200
}

export const createMigrationResult = (result: MigrationResultWithoutStatusCode): MigrationResult => {
  const statusCode = getHttpStatusCode(result)
  if (result.status === 'error') {
    const errorResult: MigrationErrorResultWithoutStatusCode = result
    const migrationErrorResult: MigrationErrorResult = {
      changedFiles: [],
      status: 'error',
      statusCode,
      ...(errorResult.errorCode === undefined ? {} : { errorCode: errorResult.errorCode }),
      ...(errorResult.errorMessage === undefined ? {} : { errorMessage: errorResult.errorMessage }),
    }
    return migrationErrorResult
  }
  const successResult: MigrationSuccessResultWithoutStatusCode = result
  const migrationSuccessResult: MigrationSuccessResult = {
    changedFiles: successResult.changedFiles,
    pullRequestTitle: successResult.pullRequestTitle,
    status: 'success',
    statusCode,
    ...(successResult.branchName === undefined ? {} : { branchName: successResult.branchName }),
    ...(successResult.commitMessage === undefined ? {} : { commitMessage: successResult.commitMessage }),
    ...(successResult.data === undefined ? {} : { data: successResult.data }),
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

export const createValidationErrorMigrationResult = (errorMessage: string, errorCode: string = ERROR_CODES.VALIDATION_ERROR): MigrationResult => {
  return createMigrationResult({
    errorCode,
    errorMessage,
    status: 'error',
  })
}
