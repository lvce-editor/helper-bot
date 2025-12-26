import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { npmCi } from '../NpmCi/NpmCi.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

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
      console.info(`[update-all-dependencies] Running npm ci`)
      const { exitCode, stderr } = await npmCi(options.clonedRepoUri, options.exec)
      if (exitCode !== 0) {
        throw new Error(`npm ci --ignore-scripts exited with code ${exitCode}: ${stderr}`)
      }
    } catch (error) {
      throw new Error(`Failed to run npm ci --ignore-scripts: ${stringifyError(error)}`)
    }

    // Check if scripts/update-dependencies.sh exists
    const updateDependenciesScriptPath = new URL('scripts/update-dependencies.sh', options.clonedRepoUri).toString()
    const updateDependenciesScriptExists = await options.fs.exists(updateDependenciesScriptPath)
    if (!updateDependenciesScriptExists) {
      console.info(`[update-all-dependencies] No update dependencies script found`)

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
          // @ts-ignore
          env: {
            NODE_ENV: '',
            NODE_OPTIONS: '--max_old_space_size=150',
          },
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
