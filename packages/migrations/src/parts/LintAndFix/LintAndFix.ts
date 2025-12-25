import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
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

interface ChangedFile {
  content: string
  path: string
}

const runEslintFix = async (fs: typeof FsPromises, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<ChangedFile[]> => {
  const baseUri = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'

  // Run eslint --fix
  try {
    console.info('[lint-and-fix]: Running eslint')
    await exec('npx', ['eslint', '.', '--fix'], {
      cwd: clonedRepoUri,
    })
  } catch {
    // eslint might exit with non-zero code if there are unfixable errors, that's ok
  }

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
    if (line.length < 4) {
      continue
    }

    const status = line.slice(0, 2)
    const filePath = line.slice(3).trim()

    // Skip if not a modified file (either in index or working tree)
    if (!status.includes('M')) {
      continue
    }

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

    // Update eslint dependencies
    const eslintResult = await addEslintCore(options.fs, options.exec, options.clonedRepoUri)

    // Write updated package.json and package-lock.json to the repo
    await options.fs.writeFile(packageJsonPath, eslintResult.newPackageJsonString)
    await options.fs.writeFile(packageLockJsonPath, eslintResult.newPackageLockJsonString)

    console.info(`[lint-and-fix]: Running npm ci`)
    // Install dependencies
    await options.exec('npm', ['ci'], {
      cwd: options.clonedRepoUri,
    })

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

    if (oldPackageLockJsonString !== eslintResult.newPackageLockJsonString) {
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
      branchName: 'feature/lint-and-fix',
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
