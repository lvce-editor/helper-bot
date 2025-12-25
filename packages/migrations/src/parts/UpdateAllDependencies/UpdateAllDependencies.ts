import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type UpdateAllDependenciesOptions = BaseMigrationOptions

export const updateAllDependencies = async (options: Readonly<UpdateAllDependenciesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    // Check if package.json exists
    const packageJsonExists = await options.fs.exists(packageJsonPath)
    if (!packageJsonExists) {
      return emptyMigrationResult
    }

    // Run npm ci --ignore-scripts
    try {
      await options.exec('npm', ['ci', '--ignore-scripts'], {
        cwd: options.clonedRepoUri,
      })
    } catch (error) {
      throw new Error(`Failed to run npm ci --ignore-scripts: ${stringifyError(error)}`)
    }

    // Check if postinstall script exists in package.json
    let packageJson: any
    try {
      const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
      packageJson = JSON.parse(packageJsonContent)
    } catch (error) {
      throw new Error(`Failed to read package.json: ${stringifyError(error)}`)
    }

    // If postinstall script exists, run it
    if (packageJson.scripts && packageJson.scripts.postinstall) {
      try {
        await options.exec('npm', ['run', 'postinstall'], {
          cwd: options.clonedRepoUri,
        })
      } catch (error) {
        throw new Error(`Failed to run npm run postinstall: ${stringifyError(error)}`)
      }
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

    if (updateDependenciesScriptExists) {
      try {
        // Make the script executable and run it
        await options.exec('chmod', ['+x', 'scripts/update-dependencies.sh'], {
          cwd: options.clonedRepoUri,
        })
        await options.exec('bash', ['scripts/update-dependencies.sh'], {
          cwd: options.clonedRepoUri,
        })
      } catch (error) {
        throw new Error(`Failed to execute scripts/update-dependencies.sh: ${stringifyError(error)}`)
      }
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
    const pullRequestTitle = 'chore: update all dependencies'
    const branchName = `chore/update-all-dependencies-${Date.now()}`

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
