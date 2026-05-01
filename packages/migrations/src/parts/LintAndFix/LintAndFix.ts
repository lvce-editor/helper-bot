import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { getChangedFiles } from '../GetChangedFiles/GetChangedFiles.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNpmVersion } from '../GetLatestNpmVersion/GetLatestNpmVersion.ts'
import { npmCi } from '../NpmCi/NpmCi.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

const normalizeVersion = (version: string): string => {
  // Remove range prefixes like ^, ~, >=, etc.
  return version.replace(/^[\^~>=<]+/, '')
}

const isVersionUpToDate = (installedVersion: string, latestVersion: string): boolean => {
  const normalizedInstalled = normalizeVersion(installedVersion)
  const normalizedLatest = normalizeVersion(latestVersion)

  // Check if normalized versions match exactly
  // This handles:
  // - Exact versions: "4.3.0" === "4.3.0" -> true
  // - Caret ranges where base matches latest: "^4.3.0" (normalized to "4.3.0") === "4.3.0" -> true
  // - Caret ranges where base doesn't match: "^4.0.0" (normalized to "4.0.0") === "4.3.0" -> false (needs upgrade)
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
    throw new Error(`Failed to add eslint: ${stringifyError(error)}`, { cause: error })
  }
}

const upgradeEslintConfig = async (exec: BaseMigrationOptions['exec'], clonedRepoUri: string, latestVersion: string, installEslint: boolean): Promise<void> => {
  try {
    const packages = installEslint ? ['eslint', `@lvce-editor/eslint-config@${latestVersion}`] : [`@lvce-editor/eslint-config@${latestVersion}`]
    const { exitCode, stderr } = await exec('npm', ['install', '--save-dev', ...packages], {
      cwd: clonedRepoUri,
    })
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix] npm install ${packages.join(' ')} exited with code ${exitCode}`)
    if (exitCode !== 0) {
      throw new Error(`npm install --save-dev ${packages.join(' ')} exited with code ${exitCode}: ${stderr}`)
    }
  } catch (error) {
    throw new Error(`Failed to upgrade @lvce-editor/eslint-config: ${stringifyError(error)}`, { cause: error })
  }
}

const runEslintFix = async (fs: typeof FsPromises, exec: BaseMigrationOptions['exec'], clonedRepoUri: string): Promise<ChangedFile[]> => {
  // Run eslint --fix
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
    // eslint might exit with non-zero code if there are unfixable errors, that's ok
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

const getLatestEslintConfigState = async (
  options: Readonly<LintAndFixOptions>,
  eslintConfigVersion: string | undefined,
): Promise<{ latestVersion: string | null; upToDate: boolean }> => {
  try {
    // eslint-disable-next-line no-console
    console.info('[lint-and-fix]: Checking for latest version of @lvce-editor/eslint-config')
    const latestVersion = await getLatestNpmVersion('@lvce-editor/eslint-config', options.fetch)
    const upToDate = eslintConfigVersion ? isVersionUpToDate(eslintConfigVersion, latestVersion) : false

    if (eslintConfigVersion) {
      // eslint-disable-next-line no-console
      console.info(
        `[lint-and-fix]: @lvce-editor/eslint-config version check - installed: ${eslintConfigVersion}, latest: ${latestVersion}, up to date: ${upToDate}`,
      )
    } else {
      // eslint-disable-next-line no-console
      console.info(`[lint-and-fix]: @lvce-editor/eslint-config is not installed, will install latest version: ${latestVersion}`)
    }

    return { latestVersion, upToDate }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.info(`[lint-and-fix]: Failed to check latest version of @lvce-editor/eslint-config, continuing with migration: ${stringifyError(error)}`)
    return {
      latestVersion: null,
      upToDate: false,
    }
  }
}

const ensureLatestEslintDependencies = async (
  options: Readonly<LintAndFixOptions>,
  latestEslintConfigVersion: string | null,
  eslintConfigVersion: string | undefined,
  eslintConfigUpToDate: boolean,
  eslintVersion: string | undefined,
): Promise<void> => {
  if (latestEslintConfigVersion) {
    if (eslintConfigVersion && !eslintConfigUpToDate) {
      // eslint-disable-next-line no-console
      console.info(`[lint-and-fix]: Upgrading @lvce-editor/eslint-config to latest version: ${latestEslintConfigVersion}`)
      await upgradeEslintConfig(options.exec, options.clonedRepoUri, latestEslintConfigVersion, !eslintVersion)
      return
    }
    if (!eslintConfigVersion) {
      // eslint-disable-next-line no-console
      console.info(`[lint-and-fix]: Installing @lvce-editor/eslint-config at latest version: ${latestEslintConfigVersion}`)
      await upgradeEslintConfig(options.exec, options.clonedRepoUri, latestEslintConfigVersion, !eslintVersion)
    }
    return
  }

  if (!eslintVersion || !eslintConfigVersion) {
    await addEslintCore(options.fs, options.exec, options.clonedRepoUri)
  }
}

export type LintAndFixOptions = BaseMigrationOptions & {
  readonly force?: boolean
}

export const lintAndFix = async (options: Readonly<LintAndFixOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    const { allDependencies, exists } = await readPackageDependencies(options.fs, packageJsonPath)
    if (!exists) {
      return emptyMigrationResult
    }

    // Check if eslint and @lvce-editor/eslint-config are installed
    const eslintVersion = allDependencies.eslint
    const eslintConfigVersion = allDependencies['@lvce-editor/eslint-config']

    const eslintState = await getLatestEslintConfigState(options, eslintConfigVersion)
    const latestEslintConfigVersion = eslintState.latestVersion
    const eslintConfigUpToDate = eslintState.upToDate

    if (eslintConfigUpToDate && !options.force) {
      // eslint-disable-next-line no-console
      console.info(`[lint-and-fix]: Already using latest version of @lvce-editor/eslint-config (${eslintConfigVersion}). Skipping migration.`)
      return emptyMigrationResult
    }

    if (eslintConfigUpToDate && options.force) {
      // eslint-disable-next-line no-console
      console.info(
        `[lint-and-fix]: Already using latest version of @lvce-editor/eslint-config (${eslintConfigVersion}), but force option is set. Continuing with eslint fix.`,
      )
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

    await ensureLatestEslintDependencies(options, latestEslintConfigVersion, eslintConfigVersion, eslintConfigUpToDate, eslintVersion)

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
