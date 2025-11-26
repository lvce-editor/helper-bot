import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import dependenciesConfig from '../../dependencies.json' with { type: 'json' }

const quickJoin = (parentFolder: string, childPath: string): string => {
  if (!parentFolder) {
    return childPath
  }
  return parentFolder + '/' + childPath
}

export interface UpdateRepositoryDependenciesOptions
  extends BaseMigrationOptions {
  tagName: string
  repositoryName: string
}

export const updateRepositoryDependencies = async (
  options: Readonly<UpdateRepositoryDependenciesOptions>,
): Promise<MigrationResult> => {
  try {
    const dependencies = dependenciesConfig.dependencies
    const releasedRepo = options.repositoryName
    const version = options.tagName.replace('v', '')

    // Find dependencies that match this repository
    const matchingDependencies = dependencies.filter(
      (dep) => dep.fromRepo === releasedRepo,
    )

    if (matchingDependencies.length === 0) {
      return createMigrationResult({
        status: 'success',
        changedFiles: [],
        pullRequestTitle: `feature: update dependencies for ${releasedRepo}`,
      })
    }

    // Update each matching dependency
    const results: MigrationResult[] = []
    for (const dependency of matchingDependencies) {
      try {
        const packageJsonPath = quickJoin(dependency.toFolder, 'package.json')
        const packageLockJsonPath = quickJoin(
          dependency.toFolder,
          'package-lock.json',
        )

        const result = await updateDependencies({
          ...options,
          dependencyName: dependency.asName || dependency.fromRepo,
          newVersion: version,
          packageJsonPath,
          packageLockJsonPath,
        })

        results.push(result)
      } catch (error) {
        results.push(
          createMigrationResult({
            status: 'error',
            changedFiles: [],
            pullRequestTitle: `feature: update dependencies for ${releasedRepo}`,
            errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
            errorMessage: stringifyError(error),
          }),
        )
      }
    }

    // Check if any updates were successful
    const hasChanges = results.some(
      (result) => result.changedFiles.length > 0,
    )
    const hasErrors = results.some((result) => result.status === 'error')

    if (hasErrors) {
      const errorMessages = results
        .filter((r) => r.status === 'error')
        .map((r) => r.errorMessage)
        .filter(Boolean)
        .join('; ')

      return createMigrationResult({
        status: 'error',
        changedFiles: [],
        pullRequestTitle: `feature: update dependencies for ${releasedRepo}`,
        errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
        errorMessage: errorMessages || 'Failed to update some dependencies',
      })
    }

    // Combine all changed files from successful updates
    const allChangedFiles = results.flatMap((result) => result.changedFiles)

    return createMigrationResult({
      status: 'success',
      changedFiles: allChangedFiles,
      pullRequestTitle: `feature: update dependencies for ${releasedRepo}`,
    })
  } catch (error) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: `feature: update dependencies for ${options.repositoryName}`,
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
    })
  }
}

