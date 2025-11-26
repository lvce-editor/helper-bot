import type { Migration, MigrationParams, MigrationResult } from './types.js'
import { applyMigrationResult } from './applyMigrationResult.js'

interface RpcMigrationResult {
  status: 'success' | 'error'
  changedFiles: Array<{ path: string; content: string }>
  pullRequestTitle: string
  errorCode?: string
  errorMessage?: string
}

export const removeNpmTokenMigration: Migration = {
  name: 'removeNpmToken',
  description:
    'Remove NODE_AUTH_TOKEN from release.yml workflow files since npm now supports OpenID Connect publishing',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { owner, repo, baseBranch = 'main', migrationsRpc } = params

      // Call RPC function to remove npm token from workflow
      const rpcResult = (await migrationsRpc.invoke(
        'removeNpmTokenFromWorkflow',
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
            'Failed to remove npm token from workflow',
        }
      }

      if (rpcResult.changedFiles.length === 0) {
        return {
          success: true,
          message: 'No NODE_AUTH_TOKEN found in release.yml',
        }
      }

      const pullRequestTitle = rpcResult.pullRequestTitle
      const commitMessage = pullRequestTitle
      const newBranch = `remove-npm-token-${Date.now()}`

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
