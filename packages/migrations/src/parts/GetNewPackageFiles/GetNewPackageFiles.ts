import type * as FsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

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
  const toRemove = [tmpFolder, tmpCacheFolder]
  try {
    oldPackageJson[dependencyKey][`@lvce-editor/${dependencyName}`] = `^${newVersion}`
    const oldPackageJsonStringified = JSON.stringify(oldPackageJson, null, 2) + '\n'
    await fs.mkdir(tmpFolder, { recursive: true })
    await fs.writeFile(join(tmpFolder, 'package.json'), oldPackageJsonStringified)
    await exec('npm', ['install', '--ignore-scripts', '--prefer-online', '--cache', tmpCacheFolder], {
      cwd: tmpFolder,
    })
    const newPackageLockJsonString = await fs.readFile(join(tmpFolder, 'package-lock.json'), 'utf8')
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
  dependencyKey: string
  dependencyName: string
  newVersion: string
  packageJsonPath: string
  packageLockJsonPath: string
}

export const getNewPackageFiles = async (options: Readonly<GetNewPackageFilesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = join(options.clonedRepoPath, options.packageJsonPath)

    let oldPackageJson: any
    try {
      const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
      oldPackageJson = JSON.parse(packageJsonContent)
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return {
          changedFiles: [],
          pullRequestTitle: `feature: update ${options.dependencyName} to version ${options.newVersion}`,
          status: 'success',
          statusCode: 200,
        }
      }
      throw error
    }

    const result = await getNewPackageFilesCore(options.fs, options.exec, oldPackageJson, options.dependencyName, options.dependencyKey, options.newVersion)

    const pullRequestTitle = `feature: update ${options.dependencyName} to version ${options.newVersion}`

    return {
      changedFiles: [
        {
          content: result.newPackageJsonString,
          path: options.packageJsonPath,
        },
        {
          content: result.newPackageLockJsonString,
          path: options.packageLockJsonPath,
        },
      ],
      pullRequestTitle,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.GET_NEW_PACKAGE_FILES_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `feature: update dependencies`,
      status: 'error',
    })
  }
}
