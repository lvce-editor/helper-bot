import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface GetNewPackageFilesParams {
  oldPackageJson: any
  dependencyName: string
  dependencyKey: string
  newVersion: string
}

export interface GetNewPackageFilesResult {
  newPackageJsonString: string
  newPackageLockJsonString: string
}

const getNewPackageFilesCore = async (
  oldPackageJson: any,
  dependencyName: string,
  dependencyKey: string,
  newVersion: string,
): Promise<GetNewPackageFilesResult> => {
  const name = oldPackageJson.name
  const tmpFolder = join(
    tmpdir(),
    `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp`,
  )
  const tmpCacheFolder = join(
    tmpdir(),
    `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp-cache`,
  )
  const toRemove = [tmpFolder, tmpCacheFolder]
  try {
    oldPackageJson[dependencyKey][`@lvce-editor/${dependencyName}`] =
      `^${newVersion}`
    const oldPackageJsonStringified =
      JSON.stringify(oldPackageJson, null, 2) + '\n'
    await mkdir(tmpFolder, { recursive: true })
    await writeFile(join(tmpFolder, 'package.json'), oldPackageJsonStringified)
    const { execa } = await import('execa')
    await execa(
      `npm`,
      [
        'install',
        '--ignore-scripts',
        '--prefer-online',
        '--cache',
        tmpCacheFolder,
      ],
      {
        cwd: tmpFolder,
      },
    )
    const newPackageLockJsonString = await readFile(
      join(tmpFolder, 'package-lock.json'),
      'utf8',
    )
    return {
      newPackageJsonString: oldPackageJsonStringified,
      newPackageLockJsonString,
    }
  } catch (error) {
    throw new Error(`Failed to update dependencies: ${error}`)
  } finally {
    for (const folder of toRemove) {
      await rm(folder, {
        recursive: true,
        force: true,
      })
    }
  }
}

export interface GetNewPackageFilesOptions extends BaseMigrationOptions {
  oldPackageJson: any
  dependencyName: string
  dependencyKey: string
  newVersion: string
  packageJsonPath: string
  packageLockJsonPath: string
}

export const getNewPackageFiles = async (
  options: GetNewPackageFilesOptions,
): Promise<MigrationResult> => {
  try {
    const {
      oldPackageJson,
      dependencyName,
      dependencyKey,
      newVersion,
      packageJsonPath,
      packageLockJsonPath,
    } = options

    const result = await getNewPackageFilesCore(
      oldPackageJson,
      dependencyName,
      dependencyKey,
      newVersion,
    )

    const pullRequestTitle = `feature: update ${dependencyName} to version ${newVersion}`

    return {
      status: 'success',
      changedFiles: [
        {
          path: packageJsonPath,
          content: result.newPackageJsonString,
        },
        {
          path: packageLockJsonPath,
          content: result.newPackageLockJsonString,
        },
      ],
      pullRequestTitle,
    }
  } catch (error) {
    return {
      status: 'error',
      changedFiles: [],
      pullRequestTitle: `feature: update dependencies`,
      errorCode: 'GET_NEW_PACKAGE_FILES_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
