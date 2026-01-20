import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestNpmVersion } from '../GetLatestNpmVersion/GetLatestNpmVersion.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { upgradePackageJsonFiles } from '../UpgradePackageJsonFiles/UpgradePackageJsonFiles.ts'
import { upgradeTestFiles } from '../UpgradeTestFiles/UpgradeTestFiles.ts'

export const modernizeMockrpcDisposal = async (options: Readonly<BaseMigrationOptions>): Promise<MigrationResult> => {
  try {
    // Fetch latest versions from npm registry
    const [latestRpcVersion, latestRpcRegistryVersion] = await Promise.all([
      getLatestNpmVersion('@lvce-editor/rpc', options.fetch),
      getLatestNpmVersion('@lvce-editor/rpc-registry', options.fetch),
    ])

    // 1. Upgrade package.json files
    const packageJsonChanges = await upgradePackageJsonFiles(options.clonedRepoUri, options.fs, latestRpcVersion, latestRpcRegistryVersion)

    // 2. Upgrade test files
    const testFileChanges = await upgradeTestFiles(options.clonedRepoUri, options.fs)

    const changedFiles = [...packageJsonChanges, ...testFileChanges]

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
      branchName: `modernize-mockrpc-disposal-${Date.now()}`,
      changedFiles,
      commitMessage: 'Modernize mockrpc-disposal: update dependencies and replace const with using for mockRpc',
      pullRequestTitle: 'feature: modernize mockrpc disposal',
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
