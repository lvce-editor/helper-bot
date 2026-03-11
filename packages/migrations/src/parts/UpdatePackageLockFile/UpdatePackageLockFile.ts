import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type UpdatePackageLockFileOptions = BaseMigrationOptions

export const updatePackageLockFile = async (options: Readonly<UpdatePackageLockFileOptions>): Promise<MigrationResult> => {
  try {
    const packageLockUri = new URL('package-lock.json', options.clonedRepoUri).toString()
    const hadPackageLockFile = await options.fs.exists(packageLockUri)
    const oldPackageLockContent = hadPackageLockFile ? await options.fs.readFile(packageLockUri, 'utf8') : ''

    await options.exec('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
      cwd: options.clonedRepoUri,
    })

    const hasPackageLockFile = await options.fs.exists(packageLockUri)
    if (!hasPackageLockFile) {
      return emptyMigrationResult
    }

    const newPackageLockContent = await options.fs.readFile(packageLockUri, 'utf8')
    if (hadPackageLockFile && oldPackageLockContent === newPackageLockContent) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/update-package-lock-file',
      changedFiles: [
        {
          content: newPackageLockContent,
          path: 'package-lock.json',
        },
      ],
      commitMessage: 'chore: update package-lock.json',
      pullRequestTitle: 'chore: update package-lock.json',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.UPDATE_PACKAGE_LOCK_FILE_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
