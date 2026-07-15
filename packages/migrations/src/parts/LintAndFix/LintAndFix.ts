import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { eslintConfigPackageName, eslintPackageName, isDependencyVersionUpToDate } from '../EslintDependencies/EslintDependencies.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNpmVersion } from '../GetLatestNpmVersion/GetLatestNpmVersion.ts'
import { npmCi } from '../NpmCi/NpmCi.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { normalizePath, resolveUri } from '../UriUtils/UriUtils.ts'

interface DependencyState {
  readonly currentVersion?: string
  readonly latestVersion: string | null
  readonly name: string
  readonly upToDate: boolean
}

const installEslintDependencies = async (
  exec: BaseMigrationOptions['exec'],
  clonedRepoUri: string,
  dependencies: readonly DependencyState[],
): Promise<void> => {
  const packages = dependencies
    .filter((dependency) => !dependency.upToDate && (dependency.latestVersion || !dependency.currentVersion))
    .map((dependency) => `${dependency.name}@${dependency.latestVersion || 'latest'}`)
  if (packages.length === 0) {
    return
  }
  try {
    const { exitCode, stderr } = await exec('npm', ['install', '--save-dev', ...packages], {
      cwd: clonedRepoUri,
    })
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix] npm install ${packages.join(' ')} exited with code ${exitCode}`)
    if (exitCode !== 0) {
      throw new Error(`npm install --save-dev ${packages.join(' ')} exited with code ${exitCode}: ${stderr}`)
    }
  } catch (error) {
    throw new Error(`Failed to upgrade ESLint dependencies: ${stringifyError(error)}`, { cause: error })
  }
}

const runEslintFix = async (fs: typeof FsPromises, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<ChangedFile[]> => {
  // Run ESLint --fix
  try {
    // eslint-disable-next-line no-console
    console.info('[lint-and-fix]: Running eslint')
    await exec('npx', ['eslint', '.', '--fix'], {
      cwd: clonedRepoUri,
      // @ts-ignore
      env: {
        NODE_ENV: '',
      },
    })
  } catch (error) {
    // ESLint might exit with non-zero code if there are unfixable errors, that's ok
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix] ESLint exited with an error: ${stringifyError(error)}`)
  }

  return []
}

const readPackageDependencies = async (
  fs: Readonly<typeof FsPromises> & { exists: (path: string | Readonly<Buffer> | Readonly<URL>) => Promise<boolean> },
  packageJsonPath: string,
): Promise<{ allDependencies: Record<string, string>; exists: boolean }> => {
  const exists = await fs.exists(packageJsonPath)
  if (!exists) {
    return {
      allDependencies: {},
      exists: false,
    }
  }

  const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(packageJsonContent) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  return {
    allDependencies: {
      ...packageJson.devDependencies,
      ...packageJson.dependencies,
    },
    exists: true,
  }
}

const getLatestDependencyState = async (options: Readonly<LintAndFixOptions>, name: string, currentVersion: string | undefined): Promise<DependencyState> => {
  try {
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix]: Checking for latest version of ${name}`)
    const latestVersion = await getLatestNpmVersion(name, options.fetch)
    const upToDate = isDependencyVersionUpToDate(currentVersion, latestVersion)

    if (currentVersion) {
      // eslint-disable-next-line no-console
      console.info(`[lint-and-fix]: ${name} version check - installed: ${currentVersion}, latest: ${latestVersion}, up to date: ${upToDate}`)
    } else {
      // eslint-disable-next-line no-console
      console.info(`[lint-and-fix]: ${name} is not installed, will install latest version: ${latestVersion}`)
    }

    return { ...(currentVersion && { currentVersion }), latestVersion, name, upToDate }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix]: Failed to check latest version of ${name}, continuing with migration: ${stringifyError(error)}`)
    return {
      ...(currentVersion && { currentVersion }),
      latestVersion: null,
      name,
      upToDate: false,
    }
  }
}

export type LintAndFixOptions = BaseMigrationOptions & {
  readonly force?: boolean
}

export const lintAndFix = async (options: Readonly<LintAndFixOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = resolveUri('package.json', options.clonedRepoUri)

    const { allDependencies, exists } = await readPackageDependencies(options.fs, packageJsonPath)
    if (!exists) {
      return emptyMigrationResult
    }

    // Check if ESLint and @lvce-editor/eslint-config are installed
    const eslintVersion = allDependencies.eslint
    const eslintConfigVersion = allDependencies['@lvce-editor/eslint-config']

    const eslintDependencies = await Promise.all([
      getLatestDependencyState(options, eslintPackageName, eslintVersion),
      getLatestDependencyState(options, eslintConfigPackageName, eslintConfigVersion),
    ])
    const eslintDependenciesUpToDate = eslintDependencies.every((dependency) => dependency.upToDate)

    if (eslintDependenciesUpToDate && !options.force) {
      // eslint-disable-next-line no-console
      console.info('[lint-and-fix]: Already using latest versions of eslint and @lvce-editor/eslint-config. Skipping migration.')
      return emptyMigrationResult
    }

    if (eslintDependenciesUpToDate && options.force) {
      // eslint-disable-next-line no-console
      console.info('[lint-and-fix]: ESLint dependencies are current, but force is set. Continuing with eslint fix.')
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

    await installEslintDependencies(options.exec, options.clonedRepoUri, eslintDependencies)

    // Run ESLint --fix and get changed files
    await runEslintFix(options.fs, options.exec, options.clonedRepoUri)

    const pullRequestTitle = 'chore: lint and fix code'

    // Use Git to detect changed files (only modified files)
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
