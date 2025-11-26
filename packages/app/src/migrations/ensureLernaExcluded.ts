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

export const ensureLernaExcludedMigration: Migration = {
  name: 'ensureLernaExcluded',
  description:
    'Ensure lerna is excluded from ncu commands in update-dependencies.sh',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { owner, repo, baseBranch = 'main', migrationsRpc } = params

      // Call RPC function to compute ensure lerna excluded content
      const rpcResult = (await migrationsRpc.invoke(
        'computeEnsureLernaExcludedContent',
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
            'Failed to compute ensure lerna excluded content',
        }
      }

      if (rpcResult.changedFiles.length === 0) {
        return {
          success: true,
          message: 'Lerna is already excluded in update-dependencies.sh script',
        }
      }

      const pullRequestTitle = rpcResult.pullRequestTitle
      const commitMessage = pullRequestTitle
      const newBranch = `ensure-lerna-excluded-${Date.now()}`

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
