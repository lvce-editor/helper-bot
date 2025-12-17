import type { MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'

export const getHttpStatusCode = (migrationResult: Omit<MigrationResult, 'statusCode'>): number => {
  if (migrationResult.status === 'error') {
    const statusCode = migrationResult.errorCode === 'DEPENDENCY_NOT_FOUND' || migrationResult.errorCode === 'FORBIDDEN' ? 400 : 424
    return statusCode
  }
  return 200
}

export const createMigrationResult = (result: Omit<MigrationResult, 'statusCode'>): MigrationResult => {
  return {
    ...result,
    // @ts-ignore
    statusCode: getHttpStatusCode(result),
  }
}

export const emptyMigrationResult: MigrationResult = {
  branchName: '',
  changedFiles: [],
  commitMessage: '',
  pullRequestTitle: '',
  status: 'success',
  statusCode: 200,
}

export const createValidationErrorMigrationResult = (errorMessage: string, errorCode: string = ERROR_CODES.UPDATE_DEPENDENCIES_FAILED): MigrationResult => {
  return createMigrationResult({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    errorCode,
    errorMessage,
    pullRequestTitle: '',
    status: 'error',
  })
}
