import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import {
  eslintConfigPackageName,
  eslintPackageName,
  getEslintDependencyVersions,
  hasEslintDependencies,
  needsEslintDependencyUpdate,
  type LatestEslintDependencyVersions,
} from '../EslintDependencies/EslintDependencies.ts'
import { createMigrationResult, createValidationErrorMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

export type UpdateEslintDependenciesOptions = BaseMigrationOptions & LatestEslintDependencyVersions

const versionPattern = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/

const validateOptions = (options: Readonly<UpdateEslintDependenciesOptions>): string | undefined => {
  if (!versionPattern.test(options.eslintVersion || '')) {
    return 'Invalid or missing eslintVersion parameter'
  }
  if (!versionPattern.test(options.eslintConfigVersion || '')) {
    return 'Invalid or missing eslintConfigVersion parameter'
  }
  return undefined
}

export const updateEslintDependencies = async (options: Readonly<UpdateEslintDependenciesOptions>): Promise<MigrationResult> => {
  try {
    const validationError = validateOptions(options)
    if (validationError) {
      return createValidationErrorMigrationResult(validationError)
    }

    const packageJsonUri = resolveUri('package.json', options.clonedRepoUri)
    if (!(await options.fs.exists(packageJsonUri))) {
      return emptyMigrationResult
    }
    const packageJson = JSON.parse(await options.fs.readFile(packageJsonUri, 'utf8'))
    const currentVersions = getEslintDependencyVersions(packageJson)
    if (!hasEslintDependencies(currentVersions) || !needsEslintDependencyUpdate(currentVersions, options)) {
      return emptyMigrationResult
    }

    const packages = [`${eslintPackageName}@${options.eslintVersion}`, `${eslintConfigPackageName}@${options.eslintConfigVersion}`]
    const { exitCode, stderr } = await options.exec('npm', ['install', '--save-dev', ...packages, '--ignore-scripts', '--prefer-online'], {
      cwd: options.clonedRepoUri,
    })
    if (exitCode !== 0) {
      throw new Error(`npm install exited with code ${exitCode}: ${stderr}`)
    }

    const packageLockJsonUri = resolveUri('package-lock.json', options.clonedRepoUri)
    if (!(await options.fs.exists(packageLockJsonUri))) {
      throw new Error('npm install did not create package-lock.json')
    }
    const pullRequestTitle = 'chore: update eslint and eslint config to latest'
    return {
      branchName: `feature/update-eslint-${options.eslintVersion}-eslint-config-${options.eslintConfigVersion}`,
      changedFiles: [
        {
          content: await options.fs.readFile(packageJsonUri, 'utf8'),
          path: 'package.json',
        },
        {
          content: await options.fs.readFile(packageLockJsonUri, 'utf8'),
          path: 'package-lock.json',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
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
