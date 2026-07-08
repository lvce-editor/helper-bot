import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, createValidationErrorMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { normalizePath, resolveUri } from '../UriUtils/UriUtils.ts'

type DependencyKey = 'dependencies' | 'devDependencies' | 'optionalDependencies'

export interface DependencyUpdate {
  readonly asName?: string
  readonly fromRepo: string
  readonly tagName: string
  readonly toFolder: string
}

export interface UpdateSpecificDependenciesOptions extends BaseMigrationOptions {
  readonly toRepo: string
  readonly updates: readonly DependencyUpdate[]
}

interface PackageUpdate {
  readonly dependencyName: string
  readonly newVersion: string
}

const dependencyKeys: readonly DependencyKey[] = ['dependencies', 'devDependencies', 'optionalDependencies']

const getScopedDependencyName = (dependencyName: string): string => {
  if (dependencyName.startsWith('@')) {
    return dependencyName
  }
  return `@lvce-editor/${dependencyName}`
}

const getDependencyKey = (packageJson: any, dependencyName: string): DependencyKey | undefined => {
  for (const key of dependencyKeys) {
    if (packageJson[key]?.[dependencyName]) {
      return key
    }
  }
  return undefined
}

const tagToVersion = (tagName: string): string => {
  return tagName.replace('v', '')
}

const validateUpdate = (update: Readonly<DependencyUpdate>): string | undefined => {
  if (!update.fromRepo || typeof update.fromRepo !== 'string' || update.fromRepo.trim() === '') {
    return 'Invalid or missing fromRepo parameter'
  }
  if (!update.toFolder || typeof update.toFolder !== 'string' || update.toFolder.trim() === '') {
    return 'Invalid or missing toFolder parameter'
  }
  if (!update.tagName || typeof update.tagName !== 'string' || update.tagName.trim() === '') {
    return 'Invalid or missing tagName parameter'
  }
  if (update.asName !== undefined && (typeof update.asName !== 'string' || update.asName.trim() === '')) {
    return 'Invalid asName parameter (must be a non-empty string if provided)'
  }
  return undefined
}

const validateOptions = (options: Readonly<UpdateSpecificDependenciesOptions>): string | undefined => {
  if (!options.toRepo || typeof options.toRepo !== 'string' || options.toRepo.trim() === '') {
    return 'Invalid or missing toRepo parameter'
  }
  if (!Array.isArray(options.updates) || options.updates.length === 0) {
    return 'Invalid or missing updates parameter'
  }
  if (!options.repositoryOwner || typeof options.repositoryOwner !== 'string' || options.repositoryOwner.trim() === '') {
    return 'Invalid or missing repositoryOwner parameter'
  }
  if (!options.clonedRepoUri || typeof options.clonedRepoUri !== 'string' || options.clonedRepoUri.trim() === '') {
    return 'Invalid or missing clonedRepoUri parameter'
  }
  for (const update of options.updates) {
    const error = validateUpdate(update)
    if (error) {
      return error
    }
  }
  return undefined
}

const groupUpdatesByFolder = (updates: readonly DependencyUpdate[]): Map<string, PackageUpdate[]> => {
  const grouped = new Map<string, PackageUpdate[]>()
  for (const update of updates) {
    const toFolder = normalizePath(update.toFolder)
    const packageUpdates = grouped.get(toFolder) || []
    packageUpdates.push({
      dependencyName: getScopedDependencyName(update.asName || update.fromRepo),
      newVersion: tagToVersion(update.tagName),
    })
    grouped.set(toFolder, packageUpdates)
  }
  return grouped
}

const updatePackageFolder = async (
  options: Readonly<UpdateSpecificDependenciesOptions>,
  toFolder: string,
  updates: readonly PackageUpdate[],
): Promise<readonly ChangedFile[]> => {
  const packageJsonPath = normalizePath(`${toFolder}/package.json`)
  const packageLockJsonPath = normalizePath(`${toFolder}/package-lock.json`)
  const packageJsonUri = resolveUri(packageJsonPath, options.clonedRepoUri)
  const packageFolderUri = resolveUri(toFolder, options.clonedRepoUri)
  let packageJson: any

  try {
    packageJson = JSON.parse(await options.fs.readFile(packageJsonUri, 'utf8'))
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return []
    }
    throw error
  }

  let hasChanges = false
  for (const update of updates) {
    const dependencyKey = getDependencyKey(packageJson, update.dependencyName)
    if (!dependencyKey) {
      continue
    }
    const newDependency = `^${update.newVersion}`
    if (packageJson[dependencyKey][update.dependencyName] === newDependency) {
      continue
    }
    packageJson[dependencyKey][update.dependencyName] = newDependency
    hasChanges = true
  }

  if (!hasChanges) {
    return []
  }

  await options.fs.writeFile(packageJsonUri, stringifyJson(packageJson))
  await options.exec('npm', ['install', '--ignore-scripts', '--prefer-online'], {
    cwd: packageFolderUri,
  })

  return [
    {
      content: await options.fs.readFile(packageJsonUri, 'utf8'),
      path: packageJsonPath,
    },
    {
      content: await options.fs.readFile(resolveUri(packageLockJsonPath, options.clonedRepoUri), 'utf8'),
      path: packageLockJsonPath,
    },
  ]
}

export const updateSpecificDependencies = async (options: Readonly<UpdateSpecificDependenciesOptions>): Promise<MigrationResult> => {
  try {
    const validationError = validateOptions(options)
    if (validationError) {
      return createValidationErrorMigrationResult(validationError)
    }

    const changedFiles: ChangedFile[] = []
    for (const [toFolder, updates] of groupUpdatesByFolder(options.updates)) {
      changedFiles.push(...(await updatePackageFolder(options, toFolder, updates)))
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/update-dependencies',
      changedFiles,
      commitMessage: 'feature: update dependencies',
      pullRequestTitle: 'feature: update dependencies',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
