import type * as FsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { pathToUri, uriToPath } from '../UriUtils/UriUtils.ts'

const getNewPackageFilesCore = async (
  fs: Readonly<typeof FsPromises>,
  exec: BaseMigrationOptions['exec'],
  oldPackageJson: any,
  dependencyName: Readonly<string>,
  dependencyKey: Readonly<string>,
  newVersion: Readonly<string>,
): Promise<{
  newPackageJsonString: string
  newPackageLockJsonString: string
}> => {
  const { name } = oldPackageJson
  const tmpFolder = join(tmpdir(), `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp`)
  const tmpCacheFolder = join(tmpdir(), `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp-cache`)
  const tmpFolderUri = pathToUri(tmpFolder)
  const tmpCacheFolderUri = pathToUri(tmpCacheFolder)
  const toRemove = [tmpFolderUri, tmpCacheFolderUri]
  try {
    oldPackageJson[dependencyKey][`@lvce-editor/${dependencyName}`] = `^${newVersion}`
    const oldPackageJsonStringified = JSON.stringify(oldPackageJson, null, 2) + '\n'
    await fs.mkdir(tmpFolderUri, { recursive: true })
    await fs.writeFile(new URL('package.json', tmpFolderUri).toString(), oldPackageJsonStringified)
    await exec('npm', ['install', '--ignore-scripts', '--prefer-online', '--cache', uriToPath(tmpCacheFolderUri)], {
      cwd: tmpFolderUri,
    })
    const newPackageLockJsonString = await fs.readFile(new URL('package-lock.json', tmpFolderUri).toString(), 'utf8')
    return {
      newPackageJsonString: oldPackageJsonStringified,
      newPackageLockJsonString,
    }
  } catch (error) {
    throw new Error(`Failed to update dependencies: ${stringifyError(error)}`)
  } finally {
    for (const folder of toRemove) {
      await fs.rm(folder, {
        force: true,
        recursive: true,
      })
    }
  }
}

export interface GetNewPackageFilesOptions extends BaseMigrationOptions {
  readonly dependencyKey: string
  readonly dependencyName: string
  readonly newVersion: string
  readonly packageJsonPath: string
  readonly packageLockJsonPath: string
}

export const getNewPackageFiles = async (options: Readonly<GetNewPackageFilesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL(options.packageJsonPath, options.clonedRepoUri).toString()

    let oldPackageJson: any
    try {
      const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
      oldPackageJson = JSON.parse(packageJsonContent)
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const result = await getNewPackageFilesCore(options.fs, options.exec, oldPackageJson, options.dependencyName, options.dependencyKey, options.newVersion)

    const pullRequestTitle = `feature: update ${options.dependencyName} to version ${options.newVersion}`

    // Normalize paths in changedFiles to use forward slashes
    const normalizedPackageJsonPath = options.packageJsonPath.replaceAll('\\', '/')
    const normalizedPackageLockJsonPath = options.packageLockJsonPath.replaceAll('\\', '/')

    return {
      branchName: `feature/update-${options.dependencyName}-to-${options.newVersion}`,
      changedFiles: [
        {
          content: result.newPackageJsonString,
          path: normalizedPackageJsonPath,
        },
        {
          content: result.newPackageLockJsonString,
          path: normalizedPackageLockJsonPath,
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.GET_NEW_PACKAGE_FILES_FAILED,
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
