import type * as FsPromises from 'node:fs/promises'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { npmCi } from '../NpmCi/NpmCi.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

const addEslintCore = async (
  fs: Readonly<typeof FsPromises>,
  exec: BaseMigrationOptions['exec'],
  clonedRepoUri: string,
): Promise<{
  newPackageJsonString: string
  newPackageLockJsonString: string
}> => {
  try {
    await exec('npm', ['install', '--save-dev', 'eslint', '@lvce-editor/eslint-config', '--ignore-scripts', '--prefer-online'], {
      cwd: clonedRepoUri,
    })
    const newPackageJsonString = await fs.readFile(new URL('package.json', clonedRepoUri).toString(), 'utf8')
    const newPackageLockJsonString = await fs.readFile(new URL('package-lock.json', clonedRepoUri).toString(), 'utf8')
    return {
      newPackageJsonString,
      newPackageLockJsonString,
    }
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

  // Use git to detect changed files (only modified files)
  const changedFiles = await getChangedFiles({
    fs,
    exec,
    clonedRepoUri,
    filterStatus: (status: string) => status.includes('M'),
  })

  console.info(`[lint-and-fix]: ${changedFiles.length} files changed.`)

  return changedFiles
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

    // Read original package.json and package-lock.json content
    const oldPackageJsonString = await options.fs.readFile(packageJsonPath, 'utf8')
    const packageLockJsonPath = new URL('package-lock.json', options.clonedRepoUri).toString()
    const packageLockExists = await options.fs.exists(packageLockJsonPath)
    const oldPackageLockJsonString = packageLockExists ? await options.fs.readFile(packageLockJsonPath, 'utf8') : null

    // Check if eslint is already in devDependencies
    const packageJson = JSON.parse(oldPackageJsonString) as { devDependencies?: Record<string, string> }
    const hasEslint = packageJson.devDependencies?.eslint !== undefined

    // Update eslint dependencies only if eslint is not already installed
    let eslintResult: { newPackageJsonString: string; newPackageLockJsonString: string }
    if (hasEslint) {
      console.info('[lint-and-fix]: eslint already in devDependencies, skipping installation')
      eslintResult = {
        newPackageJsonString: oldPackageJsonString,
        newPackageLockJsonString: oldPackageLockJsonString ?? '',
      }
    } else {
      console.info('[lint-and-fix]: eslint not found in devDependencies, installing eslint and @lvce-editor/eslint-config')
      eslintResult = await addEslintCore(options.fs, options.exec, options.clonedRepoUri)
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

    // Run eslint --fix and get changed files
    const lintChangedFiles = await runEslintFix(options.fs, options.exec, options.clonedRepoUri)

    const pullRequestTitle = 'chore: lint and fix code'

    // Only include package.json and package-lock.json if they actually changed
    const allChangedFiles: Array<{ content: string; path: string }> = []

    if (oldPackageJsonString !== eslintResult.newPackageJsonString) {
      allChangedFiles.push({
        content: eslintResult.newPackageJsonString,
        path: 'package.json',
      })
    }

    if (oldPackageLockJsonString !== eslintResult.newPackageLockJsonString && eslintResult.newPackageLockJsonString !== '') {
      allChangedFiles.push({
        content: eslintResult.newPackageLockJsonString,
        path: 'package-lock.json',
      })
    }

    allChangedFiles.push(
      ...lintChangedFiles.map((f) => ({
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
