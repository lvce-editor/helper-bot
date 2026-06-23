import type * as FsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { pathToUri, uriToPath, resolveUri } from '../UriUtils/UriUtils.ts'

export type DependencyKey = 'dependencies' | 'devDependencies' | 'optionalDependencies'

interface PackageJsonWithDependencies {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  readonly name?: string
  optionalDependencies?: Record<string, string>
}

const getScopedDependencyName = (dependencyName: string): string => {
  if (dependencyName.startsWith('@')) {
    return dependencyName
  }
  return `@lvce-editor/${dependencyName}`
}

const getSafeFileNamePart = (value: string): string => {
  return value.replaceAll('@', '').replaceAll('/', '-')
}

const getNewPackageFilesCore = async (
  fs: Readonly<typeof FsPromises>,
  exec: BaseMigrationOptions['exec'],
  oldPackageJson: PackageJsonWithDependencies,
  dependencyName: Readonly<string>,
  dependencyKey: DependencyKey,
  newVersion: Readonly<string>,
): Promise<{
  newPackageJsonString: string
  newPackageLockJsonString: string
}> => {
  const { name } = oldPackageJson
  const safePackageName = name ? getSafeFileNamePart(name) : 'package'
  const safeDependencyName = getSafeFileNamePart(dependencyName)
  const tmpFolder = await fs.mkdtemp(join(tmpdir(), `update-dependencies-${safePackageName}-${safeDependencyName}-${newVersion}-tmp-`))
  const tmpCacheFolder = await fs.mkdtemp(join(tmpdir(), `update-dependencies-${safePackageName}-${safeDependencyName}-${newVersion}-tmp-cache-`))
  const tmpFolderUri = pathToUri(tmpFolder)
  const tmpCacheFolderUri = pathToUri(tmpCacheFolder)
  const toRemove = [tmpFolderUri, tmpCacheFolderUri]
  try {
    const dependencies = oldPackageJson[dependencyKey]
    if (!dependencies) {
      throw new Error(`Missing dependency section: ${dependencyKey}`)
    }
    const packageName = getScopedDependencyName(dependencyName)
    dependencies[packageName] = `^${newVersion}`
    const oldPackageJsonStringified = stringifyJson(oldPackageJson)
    await fs.mkdir(tmpFolderUri, { recursive: true })
    await fs.writeFile(resolveUri('package.json', tmpFolderUri), oldPackageJsonStringified)
    await exec('npm', ['install', '--ignore-scripts', '--prefer-online', '--cache', uriToPath(tmpCacheFolderUri)], {
      cwd: tmpFolderUri,
    })

    // Read the updated package.json and package-lock.json
    const packageJsonUri = resolveUri('package.json', tmpFolderUri)
    const newPackageJsonString = await fs.readFile(packageJsonUri, 'utf8')
    const newPackageLockJsonString = await fs.readFile(resolveUri('package-lock.json', tmpFolderUri), 'utf8')
    return {
      newPackageJsonString,
      newPackageLockJsonString,
    }
  } catch (error) {
    throw new Error(`Failed to update dependencies: ${stringifyError(error)}`, { cause: error })
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
  readonly dependencyKey: DependencyKey
  readonly dependencyName: string
  readonly newVersion: string
  readonly packageJsonPath: string
  readonly packageLockJsonPath: string
}

export const getNewPackageFiles = async (options: Readonly<GetNewPackageFilesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = resolveUri(options.packageJsonPath, options.clonedRepoUri)

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

    const safeDependencyName = getSafeFileNamePart(options.dependencyName)
    const pullRequestTitle = `feature: update ${options.dependencyName} to version ${options.newVersion}`

    // Normalize paths in changedFiles to use forward slashes
    const normalizedPackageJsonPath = options.packageJsonPath.replaceAll('\\', '/')
    const normalizedPackageLockJsonPath = options.packageLockJsonPath.replaceAll('\\', '/')

    return {
      branchName: `feature/update-${safeDependencyName}-to-${options.newVersion}`,
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
      statusCode: 201,
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
