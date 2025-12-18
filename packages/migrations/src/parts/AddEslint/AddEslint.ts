import type * as FsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { pathToUri, uriToPath } from '../UriUtils/UriUtils.ts'

const addEslintCore = async (
  fs: Readonly<typeof FsPromises>,
  exec: BaseMigrationOptions['exec'],
  oldPackageJson: any,
): Promise<{
  newPackageJsonString: string
  newPackageLockJsonString: string
}> => {
  const { name } = oldPackageJson
  const tmpFolder = join(tmpdir(), `add-eslint-${name}-tmp`)
  const tmpCacheFolder = join(tmpdir(), `add-eslint-${name}-tmp-cache`)
  const tmpFolderUri = pathToUri(tmpFolder)
  const tmpCacheFolderUri = pathToUri(tmpCacheFolder)
  const toRemove = [tmpFolderUri, tmpCacheFolderUri]
  try {
    const oldPackageJsonStringified = stringifyJson(oldPackageJson)
    await fs.mkdir(tmpFolderUri, { recursive: true })
    await fs.writeFile(new URL('package.json', tmpFolderUri).toString(), oldPackageJsonStringified)
    await exec(
      'npm',
      ['install', '--save-dev', 'eslint', '@lvce-editor/eslint-config', '--ignore-scripts', '--prefer-online', '--cache', uriToPath(tmpCacheFolderUri)],
      {
        cwd: tmpFolderUri,
      },
    )
    const newPackageJsonString = await fs.readFile(new URL('package.json', tmpFolderUri).toString(), 'utf8')
    const newPackageLockJsonString = await fs.readFile(new URL('package-lock.json', tmpFolderUri).toString(), 'utf8')
    return {
      newPackageJsonString,
      newPackageLockJsonString,
    }
  } catch (error) {
    throw new Error(`Failed to add eslint: ${stringifyError(error)}`)
  } finally {
    for (const folder of toRemove) {
      await fs.rm(folder, {
        force: true,
        recursive: true,
      })
    }
  }
}

export type AddEslintOptions = BaseMigrationOptions

export const addEslint = async (options: Readonly<AddEslintOptions>): Promise<MigrationResult> => {
  try {
    const packageJsonPath = new URL('package.json', options.clonedRepoUri).toString()

    // Check if package.json exists
    const exists = await options.fs.exists(packageJsonPath)
    if (!exists) {
      return emptyMigrationResult
    }

    // Read package.json
    const packageJsonContent = await options.fs.readFile(packageJsonPath, 'utf8')
    const oldPackageJson = JSON.parse(packageJsonContent)

    // Check if eslint is already in devDependencies
    if (oldPackageJson.devDependencies && oldPackageJson.devDependencies['eslint']) {
      return emptyMigrationResult
    }

    const result = await addEslintCore(options.fs, options.exec, oldPackageJson)

    const pullRequestTitle = 'chore: add eslint and @lvce-editor/eslint-config'

    return {
      branchName: 'feature/add-eslint',
      changedFiles: [
        {
          content: result.newPackageJsonString,
          path: 'package.json',
        },
        {
          content: result.newPackageLockJsonString,
          path: 'package-lock.json',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.ADD_ESLINT_FAILED,
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
