import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getNewPackageFiles, type DependencyKey } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

export interface UpdateDependenciesOptions extends BaseMigrationOptions {
  dependencyName: string
  newVersion: string
  packageJsonPath: string
  packageLockJsonPath: string
}

export const updateDependencies = async (options: Readonly<UpdateDependenciesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = resolveUri(options.packageJsonPath, options.clonedRepoUri)

    // Read package.json to determine dependency key
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

    const dependencyName = `@lvce-editor/${options.dependencyName}`
    let dependencyKey: DependencyKey
    let oldDependency = ''

    // Auto-detect which dependency key to use
    if (oldPackageJson.dependencies && Object.hasOwn(oldPackageJson.dependencies, dependencyName) && oldPackageJson.dependencies[dependencyName]) {
      dependencyKey = 'dependencies'
      oldDependency = oldPackageJson.dependencies[dependencyName]
    } else if (oldPackageJson.devDependencies && Object.hasOwn(oldPackageJson.devDependencies, dependencyName) && oldPackageJson.devDependencies[dependencyName]) {
      dependencyKey = 'devDependencies'
      oldDependency = oldPackageJson.devDependencies[dependencyName]
    } else if (oldPackageJson.optionalDependencies && Object.hasOwn(oldPackageJson.optionalDependencies, dependencyName) && oldPackageJson.optionalDependencies[dependencyName]) {
      dependencyKey = 'optionalDependencies'
      oldDependency = oldPackageJson.optionalDependencies[dependencyName]
    } else {
      return emptyMigrationResult
    }

    const oldVersion = oldDependency.slice(1)
    if (oldVersion === options.newVersion) {
      return emptyMigrationResult
    }

    // Call getNewPackageFiles with the detected dependency key
    return await getNewPackageFiles({
      ...options,
      dependencyKey,
    })
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
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
