import type { Migration, MigrationParams, MigrationResult } from './types.js'
import { applyMigrationResult } from './applyMigrationResult.js'

interface RpcMigrationResult {
  status: 'success' | 'error'
  changedFiles: Array<{ path: string; content: string }>
  pullRequestTitle: string
  errorCode?: string
  errorMessage?: string
  statusCode: number
}

export const addOidcPermissionsMigration: Migration = {
  name: 'addOidcPermissions',
  description:
    'Add OpenID Connect permissions to release.yml workflow files for secure npm publishing',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { owner, repo, baseBranch = 'main', migrationsRpc } = params

      // Call RPC function to add OIDC permissions to workflow
      const rpcResult = (await migrationsRpc.invoke(
        'addOidcPermissionsToWorkflow',
        {
          repositoryOwner: owner,
          repositoryName: repo,
        },
      )) as RpcMigrationResult

      if (rpcResult.status === 'error') {
        return {
          success: false,
          error:
            rpcResult.errorMessage ||
            'Failed to add OIDC permissions to workflow',
        }
      }

      if (rpcResult.changedFiles.length === 0) {
        return {
          success: true,
          message: 'OIDC permissions already present in release.yml',
        }
      }

      const pullRequestTitle = rpcResult.pullRequestTitle
      const commitMessage = pullRequestTitle
      const newBranch = `add-oidc-permissions-${Date.now()}`

      // Apply the migration result
      return await applyMigrationResult(
        params,
        rpcResult.changedFiles,
        pullRequestTitle,
        commitMessage,
        newBranch,
      )
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
