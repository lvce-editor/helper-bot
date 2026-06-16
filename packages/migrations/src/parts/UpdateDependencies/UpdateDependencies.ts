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

const getDependency = (dependencies: Record<string, string> | undefined, dependencyName: string): string | undefined => {
  if (!dependencies || !Object.hasOwn(dependencies, dependencyName)) {
    return undefined
  }
  return dependencies[dependencyName]
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
    const dependency = getDependency(oldPackageJson.dependencies, dependencyName)
    const devDependency = getDependency(oldPackageJson.devDependencies, dependencyName)
    const optionalDependency = getDependency(oldPackageJson.optionalDependencies, dependencyName)
    if (dependency) {
      dependencyKey = 'dependencies'
      oldDependency = dependency
    } else if (devDependency) {
      dependencyKey = 'devDependencies'
      oldDependency = devDependency
    } else if (optionalDependency) {
      dependencyKey = 'optionalDependencies'
      oldDependency = optionalDependency
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
