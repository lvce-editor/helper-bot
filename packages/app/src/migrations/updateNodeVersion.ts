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

export const updateNodeVersionMigration: Migration = {
  name: 'updateNodeVersion',
  description:
    'Update Node.js version in .nvmrc, Dockerfile, and .gitpod.Dockerfile',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { owner, repo, baseBranch = 'main', migrationsRpc } = params

      // Call RPC functions to compute new content for each file
      const [nvmrcResult, dockerfileResult, gitpodResult] = await Promise.all([
        migrationsRpc.invoke('computeNewNvmrcContent', {
          repositoryOwner: owner,
          repositoryName: repo,
        }),
        migrationsRpc.invoke('computeNewDockerfileContent', {
          repositoryOwner: owner,
          repositoryName: repo,
        }),
        migrationsRpc.invoke('computeNewGitpodDockerfileContent', {
          repositoryOwner: owner,
          repositoryName: repo,
        }),
      ])

      // Check for errors
      if (nvmrcResult.status === 'error') {
        return {
          success: false,
          error: nvmrcResult.errorMessage || 'Failed to compute .nvmrc content',
        }
      }
      if (dockerfileResult.status === 'error') {
        return {
          success: false,
          error:
            dockerfileResult.errorMessage ||
            'Failed to compute Dockerfile content',
        }
      }
      if (gitpodResult.status === 'error') {
        return {
          success: false,
          error:
            gitpodResult.errorMessage ||
            'Failed to compute .gitpod.Dockerfile content',
        }
      }

      // Combine all changed files
      const allChangedFiles = [
        ...nvmrcResult.changedFiles,
        ...dockerfileResult.changedFiles,
        ...gitpodResult.changedFiles,
      ]

      if (allChangedFiles.length === 0) {
        return {
          success: true,
          message: 'Node version is already up to date',
        }
      }

      // Use the pull request title from any of the results (they should all be the same)
      const pullRequestTitle = nvmrcResult.pullRequestTitle
      const commitMessage = pullRequestTitle
      const newBranch = `update-node-version-${Date.now()}`

      // Apply the migration result
      return await applyMigrationResult(
        params,
        allChangedFiles,
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
