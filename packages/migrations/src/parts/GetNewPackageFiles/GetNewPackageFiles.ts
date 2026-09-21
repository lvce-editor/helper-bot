import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BaseMigrationOptions, ChangedFile, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { readPackageFiles } from '../ReadPackageFiles/ReadPackageFiles.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { pathToUri, uriToPath, resolveUri } from '../UriUtils/UriUtils.ts'

export type DependencyKey = 'dependencies' | 'devDependencies' | 'optionalDependencies'

interface PackageJsonWithDependencies {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  readonly name?: string
  optionalDependencies?: Record<string, string>
}

const getScopedDependencyName = (dependencyName: string): string => {
  if (dependencyName.startsWith('@')) {
    return dependencyName
  }
  return `@lvce-editor/${dependencyName}`
}

const getSafeFileNamePart = (value: string): string => {
  return value.replaceAll('@', '').replaceAll('/', '-')
}

const getWorkspacePackageFiles = async (options: Readonly<GetNewPackageFilesOptions>): Promise<ChangedFile[] | undefined> => {
  try {
    const rootPackageJson = JSON.parse(await options.fs.readFile(resolveUri('package.json', options.clonedRepoUri), 'utf8'))
    if (Array.isArray(rootPackageJson.workspaces) || Array.isArray(rootPackageJson.workspaces?.packages)) {
      return await readPackageFiles(options.fs, options.clonedRepoUri)
    }
    return undefined
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
    return undefined
  }
}

const getNewPackageFilesCore = async (options: Readonly<GetNewPackageFilesOptions>, oldPackageJson: PackageJsonWithDependencies): Promise<ChangedFile[]> => {
  const { dependencyKey, dependencyName, exec, fs, newVersion } = options
  const { name } = oldPackageJson
  const safePackageName = name ? getSafeFileNamePart(name) : 'package'
  const safeDependencyName = getSafeFileNamePart(dependencyName)
  const tmpFolder = await fs.mkdtemp(join(tmpdir(), `update-dependencies-${safePackageName}-${safeDependencyName}-${newVersion}-tmp-`))
  const tmpCacheFolder = await fs.mkdtemp(join(tmpdir(), `update-dependencies-${safePackageName}-${safeDependencyName}-${newVersion}-tmp-cache-`))
  const tmpFolderUri = pathToUri(tmpFolder) + '/'
  const tmpCacheFolderUri = pathToUri(tmpCacheFolder)
  const toRemove = [tmpFolderUri, tmpCacheFolderUri]
  try {
    const dependencies = oldPackageJson[dependencyKey]
    if (!dependencies) {
      throw new Error(`Missing dependency section: ${dependencyKey}`)
    }
    const packageName = getScopedDependencyName(dependencyName)
    dependencies[packageName] = `^${newVersion}`
    const oldPackageJsonStringified = stringifyJson(oldPackageJson)
    await fs.mkdir(tmpFolderUri, { recursive: true })
    const workspaceFiles = await getWorkspacePackageFiles(options)
    const usesWorkspaces = workspaceFiles !== undefined
    const originalFiles = workspaceFiles || []
    for (const { content, path } of originalFiles) {
      const destination = resolveUri(path, tmpFolderUri)
      await fs.mkdir(resolveUri('.', destination), { recursive: true })
      await fs.writeFile(destination, content)
    }
    const packageJsonPath = options.packageJsonPath.replaceAll('\\', '/')
    const packageLockJsonPath = options.packageLockJsonPath.replaceAll('\\', '/')
    await fs.writeFile(resolveUri(usesWorkspaces ? packageJsonPath : 'package.json', tmpFolderUri), oldPackageJsonStringified)
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await exec('npm', ['install', '--ignore-scripts', '--prefer-online', '--cache', uriToPath(tmpCacheFolderUri)], {
          cwd: tmpFolderUri,
        })
        break
      } catch (error) {
        const message = stringifyError(error)
        // A release webhook can arrive before its npm version is available.
        if (attempt === 4 || !message.includes('ETARGET') || !message.includes(`No matching version found for ${packageName}@^${newVersion}.`)) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 30_000))
      }
    }

    if (usesWorkspaces) {
      const previous = new Map(originalFiles.map(({ content, path }) => [path, content]))
      const updatedFiles = await readPackageFiles(fs, tmpFolderUri)
      return updatedFiles.filter(({ content, path }) => previous.get(path) !== content)
    }
    return [
      { content: await fs.readFile(resolveUri('package.json', tmpFolderUri), 'utf8'), path: packageJsonPath },
      { content: await fs.readFile(resolveUri('package-lock.json', tmpFolderUri), 'utf8'), path: packageLockJsonPath },
    ]
  } catch (error) {
    throw new Error(`Failed to update dependencies: ${stringifyError(error)}`, { cause: error })
  } finally {
    for (const folder of toRemove) {
      await fs.rm(folder, {
        force: true,
        recursive: true,
      })
    }
  }
}

export interface GetNewPackageFilesOptions extends BaseMigrationOptions {
  readonly dependencyKey: DependencyKey
  readonly dependencyName: string
  readonly newVersion: string
  readonly packageJsonPath: string
  readonly packageLockJsonPath: string
}

export const getNewPackageFiles = async (options: Readonly<GetNewPackageFilesOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = resolveUri(options.packageJsonPath, options.clonedRepoUri)

    let oldPackageJson: any
    try {
      const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
      oldPackageJson = JSON.parse(packageJsonContent)
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const changedFiles = await getNewPackageFilesCore(options, oldPackageJson)

    const safeDependencyName = getSafeFileNamePart(options.dependencyName)
    const pullRequestTitle = `feature: update ${options.dependencyName} to version ${options.newVersion}`

    return {
      branchName: `feature/update-${safeDependencyName}-to-${options.newVersion}`,
      changedFiles,
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.GET_NEW_PACKAGE_FILES_FAILED,
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
