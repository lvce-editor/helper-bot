import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, createValidationErrorMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'

export interface UpdateSpecificDependencyOptions extends BaseMigrationOptions {
  asName?: string
  fromRepo: string
  tagName: string
  toFolder: string
  toRepo: string
}

export const updateSpecificDependency = async (options: Readonly<UpdateSpecificDependencyOptions>): Promise<MigrationResult> => {
  try {
    // Validate required parameters
    if (!options.fromRepo || typeof options.fromRepo !== 'string' || options.fromRepo.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing fromRepo parameter', ERROR_CODES.UPDATE_DEPENDENCIES_FAILED)
    }

    if (!options.toRepo || typeof options.toRepo !== 'string' || options.toRepo.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing toRepo parameter', ERROR_CODES.UPDATE_DEPENDENCIES_FAILED)
    }

    if (!options.toFolder || typeof options.toFolder !== 'string' || options.toFolder.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing toFolder parameter', ERROR_CODES.UPDATE_DEPENDENCIES_FAILED)
    }

    if (!options.tagName || typeof options.tagName !== 'string' || options.tagName.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing tagName parameter', ERROR_CODES.UPDATE_DEPENDENCIES_FAILED)
    }

    if (!options.repositoryOwner || typeof options.repositoryOwner !== 'string' || options.repositoryOwner.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing repositoryOwner parameter', ERROR_CODES.UPDATE_DEPENDENCIES_FAILED)
    }

    if (options.asName !== undefined && (typeof options.asName !== 'string' || options.asName.trim() === '')) {
      return createValidationErrorMigrationResult('Invalid asName parameter (must be a non-empty string if provided)', ERROR_CODES.UPDATE_DEPENDENCIES_FAILED)
    }

    if (!options.clonedRepoPath || typeof options.clonedRepoPath !== 'string' || options.clonedRepoPath.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing clonedRepoPath parameter', ERROR_CODES.UPDATE_DEPENDENCIES_FAILED)
    }

    const version = options.tagName.replace('v', '')
    const dependencyName = options.asName || options.fromRepo
    const packageJsonPath = join(options.toFolder, 'package.json')
    const packageLockJsonPath = join(options.toFolder, 'package-lock.json')

    // Update the dependency using the already cloned repository
    const result = await updateDependencies({
      ...options,
      dependencyName,
      newVersion: version,
      packageJsonPath,
      packageLockJsonPath,
    })

    return result
  } catch (error) {
    return createMigrationResult({
      branchName: '',
      changedFiles: [],
      commitMessage: '',
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: `feature: update ${options.fromRepo} dependency in ${options.toRepo}`,
      status: 'error',
    })
  }
}
