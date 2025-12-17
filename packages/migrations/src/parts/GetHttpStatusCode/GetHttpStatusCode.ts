import type { MigrationResult } from '../Types/Types.ts'

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
  changedFiles: [],
  pullRequestTitle: '',
  status: 'success',
  statusCode: 200,
  branchName: '',
  commitMessage: '',
}
