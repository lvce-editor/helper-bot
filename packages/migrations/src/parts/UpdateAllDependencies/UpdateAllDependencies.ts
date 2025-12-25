import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

export type UpdateAllDependenciesOptions = BaseMigrationOptions

const getChangedFiles = async (fs: Readonly<typeof FsPromises>, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<ChangedFile[]> => {
  const baseUri = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'

  // Use git to detect changed files
  const gitResult = await exec('git', ['status', '--porcelain'], {
    cwd: clonedRepoUri,
  })

  const changedFiles: ChangedFile[] = []
  const outputLines = gitResult.stdout.split('\n').filter((line) => line.trim().length > 0)

  for (const line of outputLines) {
    // Git status --porcelain format: XY PATH
    // X = index status, Y = working tree status
    // Format is exactly 2 characters for status, then a space, then the path
    // For untracked files, format is "?? PATH"
    if (line.length < 4) {
      continue
    }

    const status = line.slice(0, 2)
    const filePath = line.slice(3).trim()

    // Skip deleted files (D in either position means deleted)
    if (status.includes('D')) {
      continue
    }

    // Handle modified, added, untracked, or renamed files
    const fileUri = new URL(filePath, baseUri).toString()
    try {
      const content = await fs.readFile(fileUri, 'utf8')
      changedFiles.push({
        content,
        path: normalizePath(filePath),
      })
    } catch (error) {
      throw new Error(`Failed to read ${fileUri}: ${stringifyError(error)}`)
    }
  }

  return changedFiles
}

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

    // Check if update-dependencies.sh exists
    const updateDependenciesScriptPath = new URL('update-dependencies.sh', options.clonedRepoUri).toString()
    const updateDependenciesScriptExists = await options.fs.exists(updateDependenciesScriptPath)

    if (updateDependenciesScriptExists) {
      try {
        // Make the script executable and run it
        await options.exec('chmod', ['+x', 'update-dependencies.sh'], {
          cwd: options.clonedRepoUri,
        })
        await options.exec('bash', ['update-dependencies.sh'], {
          cwd: options.clonedRepoUri,
        })
      } catch (error) {
        throw new Error(`Failed to execute update-dependencies.sh: ${stringifyError(error)}`)
      }
    }

    // Check for changed files using git
    const changedFiles = await getChangedFiles(options.fs, options.exec, options.clonedRepoUri)

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
