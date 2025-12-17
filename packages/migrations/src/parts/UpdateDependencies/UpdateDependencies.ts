import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
<<<<<<< HEAD
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
=======
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getNewPackageFiles } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
>>>>>>> origin/main

export interface UpdateDependenciesOptions extends BaseMigrationOptions {
  dependencyName: string
  newVersion: string
  packageJsonPath: string
  packageLockJsonPath: string
}

export const updateDependencies = async (options: Readonly<UpdateDependenciesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = join(options.clonedRepoPath, options.packageJsonPath)

    // Read package.json to determine dependency key
    let oldPackageJson: any
    try {
      const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
      oldPackageJson = JSON.parse(packageJsonContent)
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
<<<<<<< HEAD
        return emptyMigrationResult
=======
        return {
          changedFiles: [],
          pullRequestTitle: `feature: update ${options.dependencyName} to version ${options.newVersion}`,
          status: 'success',
          statusCode: 200,
        }
>>>>>>> origin/main
      }
      throw error
    }

    const dependencyName = `@lvce-editor/${options.dependencyName}`
    let dependencyKey = ''
    let oldDependency = ''

    // Auto-detect which dependency key to use
    if (oldPackageJson.dependencies && oldPackageJson.dependencies[dependencyName]) {
      dependencyKey = 'dependencies'
      oldDependency = oldPackageJson.dependencies[dependencyName]
    } else if (oldPackageJson.devDependencies && oldPackageJson.devDependencies[dependencyName]) {
      dependencyKey = 'devDependencies'
      oldDependency = oldPackageJson.devDependencies[dependencyName]
    } else if (oldPackageJson.optionalDependencies && oldPackageJson.optionalDependencies[dependencyName]) {
      dependencyKey = 'optionalDependencies'
      oldDependency = oldPackageJson.optionalDependencies[dependencyName]
    } else {
<<<<<<< HEAD
      return emptyMigrationResult
=======
      return {
        changedFiles: [],
        errorCode: 'DEPENDENCY_NOT_FOUND',
        errorMessage: `Dependency ${dependencyName} not found in ${options.packageJsonPath}`,
        pullRequestTitle: `feature: update ${options.dependencyName} to version ${options.newVersion}`,
        status: 'success',
        statusCode: 200,
      }
>>>>>>> origin/main
    }

    const oldVersion = oldDependency.slice(1)
    if (oldVersion === options.newVersion) {
<<<<<<< HEAD
      return emptyMigrationResult
=======
      return {
        changedFiles: [],
        pullRequestTitle: `feature: update ${options.dependencyName} to version ${options.newVersion}`,
        status: 'success',
        statusCode: 200,
      }
>>>>>>> origin/main
    }

    // Call getNewPackageFiles with the detected dependency key
    return await getNewPackageFiles({
      ...options,
      dependencyKey,
    })
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `feature: update ${options.dependencyName} to version ${options.newVersion}`,
      status: 'error',
    })
  }
}
