import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { npmCi } from '../NpmCi/NpmCi.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

interface NpmPackageInfo {
  version: string
}

const getLatestNpmVersion = async (packageName: string, fetchFn: typeof globalThis.fetch): Promise<string> => {
  const response = await fetchFn(`https://registry.npmjs.org/${packageName}/latest`)
  if (!response.ok) {
    throw new Error(`Failed to fetch latest version for ${packageName}: ${response.statusText}`)
  }
  const packageInfo = (await response.json()) as NpmPackageInfo
  return packageInfo.version
}

const normalizeVersion = (version: string): string => {
  // Remove range prefixes like ^, ~, >=, etc.
  return version.replace(/^[\^~>=<]+/, '')
}

const isVersionUpToDate = (installedVersion: string, latestVersion: string): boolean => {
  const normalizedInstalled = normalizeVersion(installedVersion)
  const normalizedLatest = normalizeVersion(latestVersion)

  // If exact version match
  if (normalizedInstalled === normalizedLatest) {
    return true
  }

  // If installed version is a caret range (^), check if latest is within the same major version
  if (installedVersion.startsWith('^')) {
    const installedMajor = normalizedInstalled.split('.')[0]
    const latestMajor = normalizedLatest.split('.')[0]
    // If major versions match, the caret range will include the latest version
    return installedMajor === latestMajor
  }

  // For other cases, do exact comparison
  return normalizedInstalled === normalizedLatest
}

const addEslintCore = async (fs: Readonly<typeof FsPromises>, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<void> => {
  try {
    const { exitCode } = await exec('npm', ['install', '--save-dev', 'eslint', '@lvce-editor/eslint-config'], {
      cwd: clonedRepoUri,
    })
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix] npm install eslint exited with code ${exitCode}`)
  } catch (error) {
    throw new Error(`Failed to add eslint: ${stringifyError(error)}`)
  }
}

const runEslintFix = async (fs: typeof FsPromises, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<ChangedFile[]> => {
  // Run eslint --fix
  try {
    // eslint-disable-next-line no-console
    console.info('[lint-and-fix]: Running eslint')
    await exec('npx', ['eslint', '.', '--fix'], {
      cwd: clonedRepoUri,
    })
  } catch (error) {
    // eslint might exit with non-zero code if there are unfixable errors, that's ok
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix] ESLint exited with an error: ${stringifyError(error)}`)
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

    // Read package.json to check for eslint and @lvce-editor/eslint-config
    const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonContent) as {
      devDependencies?: Record<string, string>
      dependencies?: Record<string, string>
    }

    const devDependencies = packageJson.devDependencies || {}
    const dependencies = packageJson.dependencies || {}
    const allDependencies = { ...devDependencies, ...dependencies }

    // Check if eslint and @lvce-editor/eslint-config are installed
    const eslintVersion = allDependencies.eslint
    const eslintConfigVersion = allDependencies['@lvce-editor/eslint-config']

    if (eslintVersion && eslintConfigVersion) {
      // Both packages are installed, check if they're already at latest versions
      try {
        // eslint-disable-next-line no-console
        console.info('[lint-and-fix]: Checking for latest versions of eslint and @lvce-editor/eslint-config')
        const [latestEslintVersion, latestEslintConfigVersion] = await Promise.all([
          getLatestNpmVersion('eslint', options.fetch),
          getLatestNpmVersion('@lvce-editor/eslint-config', options.fetch),
        ])

        const eslintUpToDate = isVersionUpToDate(eslintVersion, latestEslintVersion)
        const eslintConfigUpToDate = isVersionUpToDate(eslintConfigVersion, latestEslintConfigVersion)

        if (eslintUpToDate && eslintConfigUpToDate) {
          // eslint-disable-next-line no-console
          console.info(
            `[lint-and-fix]: Already using latest versions (eslint: ${eslintVersion}, @lvce-editor/eslint-config: ${eslintConfigVersion}). Skipping migration.`,
          )
          return emptyMigrationResult
        }

        // eslint-disable-next-line no-console
        console.info(
          `[lint-and-fix]: Version check - eslint: ${eslintVersion} vs ${latestEslintVersion} (up to date: ${eslintUpToDate}), @lvce-editor/eslint-config: ${eslintConfigVersion} vs ${latestEslintConfigVersion} (up to date: ${eslintConfigUpToDate})`,
        )
      } catch (error) {
        // If we can't fetch latest versions, continue with the migration
        // eslint-disable-next-line no-console
        console.info(`[lint-and-fix]: Failed to check latest versions, continuing with migration: ${stringifyError(error)}`)
      }
    }

    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix]: Running npm ci`)
    // Install dependencies
    const { exitCode, stderr } = await npmCi(options.clonedRepoUri, options.exec)
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix]: npm ci exit code: ${exitCode}`)
    if (exitCode !== 0) {
      // eslint-disable-next-line no-console
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
      clonedRepoUri: options.clonedRepoUri,
      exec: options.exec,
      filterStatus: (status: string) => status.includes('M'),
      fs: options.fs,
    })

    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix]: ${changedFiles.length} files changed.`)

    // Only include package.json and package-lock.json if they actually changed
    const allChangedFiles: Array<{ content: string; path: string }> = changedFiles.map((f) => ({
      content: f.content,
      path: normalizePath(f.path),
    }))

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
