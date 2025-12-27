import type * as FsPromises from 'node:fs/promises'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { npmCi } from '../NpmCi/NpmCi.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

const addEslintCore = async (fs: Readonly<typeof FsPromises>, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<void> => {
  try {
    const { exitCode } = await exec('npm', ['install', '--save-dev', 'eslint', '@lvce-editor/eslint-config', '--ignore-scripts', '--prefer-online'], {
      cwd: clonedRepoUri,
    })
    console.info(`[lint-and-fix] npm install eslint exited with code ${exitCode}`)
  } catch (error) {
    throw new Error(`Failed to add eslint: ${stringifyError(error)}`)
  }
}

const runEslintFix = async (fs: typeof FsPromises, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<ChangedFile[]> => {
  // Run eslint --fix
  try {
    console.info('[lint-and-fix]: Running eslint')
    await exec('npx', ['eslint', '.', '--fix'], {
      cwd: clonedRepoUri,
    })
  } catch (error) {
    // eslint might exit with non-zero code if there are unfixable errors, that's ok
    console.info(`[lint-and-fix] ESLint exited with an error: ${error}`)
  }

  return []
}

export type LintAndFixOptions = BaseMigrationOptions

export const lintAndFix = async (options: Readonly<LintAndFixOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    // Check if package.json exists
    const exists = await options.fs.exists(packageJsonPath)
    if (!exists) {
      return emptyMigrationResult
    }

    console.info(`[lint-and-fix]: Running npm ci`)
    // Install dependencies
    const { exitCode, stderr } = await npmCi(options.clonedRepoUri, options.exec)
    console.info(`[lint-and-fix]: npm ci exit code: ${exitCode}`)
    if (exitCode !== 0) {
      console.info(`[lint-and-fix]: npm ci error: ${stderr}`)
      return {
        changedFiles: [],
        errorCode: 'E_NPM_INSTALL_FAILED',
        errorMessage: `npm ci exited with code ${exitCode}`,
        status: 'error',
        statusCode: 500,
      }
    }

    // Update eslint dependencies only if eslint is not already installed
    await addEslintCore(options.fs, options.exec, options.clonedRepoUri)

    // Run eslint --fix and get changed files
    await runEslintFix(options.fs, options.exec, options.clonedRepoUri)

    const pullRequestTitle = 'chore: lint and fix code'

    // Use git to detect changed files (only modified files)
    const changedFiles = await getChangedFiles({
      fs: options.fs,
      exec: options.exec,
      clonedRepoUri: options.clonedRepoUri,
      filterStatus: (status: string) => status.includes('M'),
    })

    console.info(`[lint-and-fix]: ${changedFiles.length} files changed.`)

    // Only include package.json and package-lock.json if they actually changed
    const allChangedFiles: Array<{ content: string; path: string }> = []

    allChangedFiles.push(
      ...changedFiles.map((f) => ({
        content: f.content,
        path: normalizePath(f.path),
      })),
    )

    return {
      branchName: `feature/lint-and-fix-${Date.now()}`,
      changedFiles: allChangedFiles,
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.LINT_AND_FIX_FAILED,
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
