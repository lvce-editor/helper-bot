import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

const getNewPackageFilesCore = async (
  oldPackageJson: any,
  dependencyName: string,
  dependencyKey: string,
  newVersion: string,
): Promise<{
  newPackageJsonString: string
  newPackageLockJsonString: string
}> => {
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
  dependencyName: string
  dependencyKey: string
  newVersion: string
  packageJsonPath: string
  packageLockJsonPath: string
}

export const getNewPackageFiles = async (
  options: GetNewPackageFilesOptions,
): Promise<MigrationResult> => {
  const clonedRepo = await cloneRepositoryTmp(
    options.repositoryOwner,
    options.repositoryName,
  )
  try {
    const packageJsonPath = join(clonedRepo.path, options.packageJsonPath)

    let oldPackageJson: any
    try {
      const packageJsonContent = await readFile(packageJsonPath, 'utf8')
      oldPackageJson = JSON.parse(packageJsonContent)
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return {
          status: 'success',
          changedFiles: [],
          pullRequestTitle: `feature: update ${options.dependencyName} to version ${options.newVersion}`,
        }
      }
      throw error
    }

    const result = await getNewPackageFilesCore(
      oldPackageJson,
      options.dependencyName,
      options.dependencyKey,
      options.newVersion,
    )

    const pullRequestTitle = `feature: update ${options.dependencyName} to version ${options.newVersion}`

    return {
      status: 'success',
      changedFiles: [
        {
          path: options.packageJsonPath,
          content: result.newPackageJsonString,
        },
        {
          path: options.packageLockJsonPath,
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
  } finally {
    await clonedRepo[Symbol.asyncDispose]()
  }
}
