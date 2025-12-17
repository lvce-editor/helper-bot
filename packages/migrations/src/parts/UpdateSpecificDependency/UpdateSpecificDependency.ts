import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, createValidationErrorMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

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
      return createValidationErrorMigrationResult('Invalid or missing fromRepo parameter')
    }

    if (!options.toRepo || typeof options.toRepo !== 'string' || options.toRepo.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing toRepo parameter')
    }

    if (!options.toFolder || typeof options.toFolder !== 'string' || options.toFolder.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing toFolder parameter')
    }

    if (!options.tagName || typeof options.tagName !== 'string' || options.tagName.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing tagName parameter')
    }

    if (!options.repositoryOwner || typeof options.repositoryOwner !== 'string' || options.repositoryOwner.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing repositoryOwner parameter')
    }

    if (options.asName !== undefined && (typeof options.asName !== 'string' || options.asName.trim() === '')) {
      return createValidationErrorMigrationResult('Invalid asName parameter (must be a non-empty string if provided)')
    }

    if (!options.clonedRepoUri || typeof options.clonedRepoUri !== 'string' || options.clonedRepoUri.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing clonedRepoUri parameter')
    }

    const version = options.tagName.replace('v', '')
    const dependencyName = options.asName || options.fromRepo
    const normalizedToFolder = normalizePath(options.toFolder)
    const packageJsonPath = normalizePath(`${normalizedToFolder}/package.json`)
    const packageLockJsonPath = normalizePath(`${normalizedToFolder}/package-lock.json`)

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
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
