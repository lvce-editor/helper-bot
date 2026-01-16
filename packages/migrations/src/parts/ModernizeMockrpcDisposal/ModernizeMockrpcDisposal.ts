import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNpmVersion } from '../GetLatestNpmVersion/GetLatestNpmVersion.ts'
import { listFiles } from '../ListFiles/ListFiles.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'
import { replaceMockRpcPattern } from './ReplaceMockRpcPattern.ts'
import { updatePackageJsonDependencies } from './UpdatePackageJsonDependencies.ts'

const findPackageJsonFiles = async (clonedRepoUri: string, fs: typeof FsPromises): Promise<string[]> => {
  const packageJsonFiles: string[] = []

  try {
    const rootEntries = await fs.readdir(new URL('.', clonedRepoUri).toString(), { recursive: true })
    const filtered = rootEntries.filter((file) => !file.includes('node_modules') && !file.includes('.git'))

    for (const entry of rootEntries) {
      if (entry === 'node_modules' || entry === '.git') {
        continue
      }

      try {
        const entryUri = new URL(entry, clonedRepoUri).toString()
        const stat = await fs.stat(entryUri)

        if (stat.isDirectory()) {
          const subEntries = await fs.readdir(entryUri)
          for (const subEntry of subEntries) {
            if (subEntry === 'package.json') {
              packageJsonFiles.push(normalizePath(`${entry}/${subEntry}`))
            }
          }
        } else if (entry === 'package.json') {
          packageJsonFiles.push(normalizePath(entry))
        }
      } catch {
        // Skip entries that can't be accessed
        continue
      }
    }
  } catch {
    // If directory listing fails, fall back to common paths
    packageJsonFiles.push(
      'package.json',
      'packages/app/package.json',
      'packages/exec-worker/package.json',
      'packages/github-worker/package.json',
      'packages/migrations/package.json',
    )
  }

  return packageJsonFiles
}

const findTestFiles = async (clonedRepoUri: string, fs: typeof FsPromises): Promise<string[]> => {
  const testFiles: string[] = []
  const testDirectories = ['packages/app/test', 'packages/exec-worker/test', 'packages/github-worker/test', 'packages/migrations/test']

  for (const testDir of testDirectories) {
    try {
      const testDirUri = new URL(normalizePath(testDir), clonedRepoUri).toString()
      const entries = await fs.readdir(testDirUri)

      for (const entry of entries) {
        if (entry.endsWith('.test.ts') || entry.endsWith('.test.js')) {
          testFiles.push(normalizePath(`${testDir}/${entry}`))
        }
      }
    } catch {
      // Skip directories that don't exist
      continue
    }
  }

  return testFiles
}

export interface ModernizeMockrpcDisposalOptions extends BaseMigrationOptions {}

export const modernizeMockrpcDisposal = async (options: Readonly<ModernizeMockrpcDisposalOptions>): Promise<MigrationResult> => {
  try {
    const changedFiles: Array<{ path: string; content: string }> = []

    // Fetch latest versions from npm registry
    const [latestRpcVersion, latestRpcRegistryVersion] = await Promise.all([
      getLatestNpmVersion('@lvce-editor/rpc', options.fetch),
      getLatestNpmVersion('@lvce-editor/rpc-registry', options.fetch),
    ])

    const files = await listFiles(options.clonedRepoUri, options.fs)
    // 1. Update @lvce-editor/rpc and @lvce-editor/rpc-registry dependencies
    const packageJsonFiles = await findPackageJsonFiles(options.clonedRepoUri, options.fs)

    for (const packageJsonPath of packageJsonFiles) {
      const fullPath = normalizePath(packageJsonPath)
      try {
        const packageJsonUri = new URL(fullPath, options.clonedRepoUri).toString()
        const content = await options.fs.readFile(packageJsonUri, 'utf8')
        const packageJson = JSON.parse(content)

        const updated = updatePackageJsonDependencies({
          latestRpcRegistryVersion,
          latestRpcVersion,
          packageJson,
        })

        if (updated) {
          const newContent = JSON.stringify(packageJson, null, 2) + '\n'
          await options.fs.writeFile(packageJsonUri, newContent)
          changedFiles.push({
            content: newContent,
            path: fullPath,
          })
        }
      } catch {
        // Skip files that don't exist or can't be parsed
        continue
      }
    }

    // 2. Replace mockRpc patterns in test files
    const testFiles = await findTestFiles(options.clonedRepoUri, options.fs)

    for (const testFilePath of testFiles) {
      try {
        const testFileUri = new URL(testFilePath, options.clonedRepoUri).toString()
        const content = await options.fs.readFile(testFileUri, 'utf8')

        const newContent = replaceMockRpcPattern(content)

        if (newContent !== content) {
          await options.fs.writeFile(testFileUri, newContent)
          changedFiles.push({
            content: newContent,
            path: testFilePath,
          })
        }
      } catch {
        // Skip files that can't be read or written
        continue
      }
    }

    if (changedFiles.length === 0) {
      return {
        branchName: '',
        changedFiles: [],
        commitMessage: '',
        pullRequestTitle: '',
        status: 'success',
        statusCode: 200,
      }
    }

    return createMigrationResult({
      branchName: 'modernize-mockrpc-disposal',
      changedFiles,
      commitMessage: 'Modernize mockrpc-disposal: update dependencies and replace const with using for mockRpc',
      pullRequestTitle: 'Modernize mockrpc-disposal',
      status: 'success',
    })
  } catch (error) {
    return createMigrationResult({
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
    })
  }
}
