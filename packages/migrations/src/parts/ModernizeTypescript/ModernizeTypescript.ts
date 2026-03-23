import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type ModernizeTypescriptOptions = BaseMigrationOptions

const getMajorVersion = (version: string): number | undefined => {
  const match = version.match(/\d+/)
  if (!match) {
    return undefined
  }
  return Number.parseInt(match[0], 10)
}

export const modernizeTypescript = async (options: Readonly<ModernizeTypescriptOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()
    const hasPackageJson = await options.fs.exists(packageJsonPath)
    if (!hasPackageJson) {
      return emptyMigrationResult
    }

    const oldPackageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(oldPackageJsonContent) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    const version = packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript
    if (!version) {
      return emptyMigrationResult
    }

    const majorVersion = getMajorVersion(version)
    if (majorVersion === undefined || majorVersion >= 6) {
      return emptyMigrationResult
    }

    await options.exec('npm', ['install', 'typescript@6'], {
      cwd: options.clonedRepoUri,
    })

    const newPackageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
    const changedFiles: Array<{ path: string; content: string }> = [
      {
        content: newPackageJsonContent,
        path: 'package.json',
      },
    ]

    const packageLockPath = new URL('package-lock.json', options.clonedRepoUri).toString()
    const hasPackageLock = await options.fs.exists(packageLockPath)
    if (hasPackageLock) {
      const packageLockContent = await options.fs.readFile(packageLockPath, 'utf8')
      changedFiles.push({
        content: packageLockContent,
        path: 'package-lock.json',
      })
    }

    return {
      branchName: 'feature/modernize-typescript',
      changedFiles,
      commitMessage: 'ci: modernize typescript to v6',
      pullRequestTitle: 'ci: modernize typescript to v6',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.MODERNIZE_TYPESCRIPT_FAILED,
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