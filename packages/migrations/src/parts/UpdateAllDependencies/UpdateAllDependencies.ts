import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { downgradeEslintIfNeeded } from '../DowngradeEslintIfNeeded/DowngradeEslintIfNeeded.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { findPackageJsonFiles } from '../FindPackageJsonFiles/FindPackageJsonFiles.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { uriToPath } from '../UriUtils/UriUtils.ts'

export type UpdateAllDependenciesOptions = BaseMigrationOptions

export const updateAllDependencies = async (options: Readonly<UpdateAllDependenciesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    // Check if package.json exists
    const packageJsonExists = await options.fs.exists(packageJsonPath)
    if (!packageJsonExists) {
      return emptyMigrationResult
    }

    // Check if scripts/update-dependencies.sh exists
    const updateDependenciesScriptPath = new URL('scripts/update-dependencies.sh', options.clonedRepoUri).toString()
    const updateDependenciesScriptExists = await options.fs.exists(updateDependenciesScriptPath)
    if (!updateDependenciesScriptExists) {
      return {
        ...emptyMigrationResult,
        data: {
          message: 'no update dependencies script found',
        },
      }
    }

    try {
      // Make the script executable and run it
      await options.exec('chmod', ['+x', 'scripts/update-dependencies.sh'], {
        cwd: options.clonedRepoUri,
      })
      await options.exec('bash', ['scripts/update-dependencies.sh'], {
        cwd: options.clonedRepoUri,
        // @ts-ignore
        env: {
          NODE_ENV: '',
          NODE_OPTIONS: '--max_old_space_size=1500',
        },
      })

      // Check all package.json files for ESLint 10 and downgrade if needed
      const packageJsonFiles = await findPackageJsonFiles(options.clonedRepoUri, options.fs)
      for (const packageJsonUri of packageJsonFiles) {
        const packageDir = uriToPath(new URL('.', packageJsonUri).toString().replace(/\/$/, ''))
        await downgradeEslintIfNeeded(options.fs, options.exec, packageJsonUri, packageDir)
      }
    } catch (error) {
      throw new Error(`Failed to execute scripts/update-dependencies.sh: ${stringifyError(error)}`)
    }

    // Check for changed files using git
    const changedFiles = await getChangedFiles({
      clonedRepoUri: options.clonedRepoUri,
      exec: options.exec,
      fs: options.fs,
    })

    // If no changed files, return empty result
    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    // Return result with changed files
    const pullRequestTitle = 'feature: update dependencies'
    const branchName = `feature/update-dependencies-${Date.now()}`

    return {
      branchName,
      changedFiles,
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
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
