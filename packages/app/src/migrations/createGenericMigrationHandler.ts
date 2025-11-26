import type { Request, Response } from 'express'
import type { Probot } from 'probot'
import { applyMigrationResult } from './applyMigrationResult.js'
import type { MigrationParams } from './types.js'

interface RpcMigrationResult {
  status: 'success' | 'error'
  changedFiles: Array<{ path: string; content: string }>
  pullRequestTitle: string
  errorCode?: string
  errorMessage?: string
}

const verifySecret = (
  req: Request,
  res: Response,
  secret: string | undefined,
): boolean => {
  const providedSecret = req.query.secret
  if (providedSecret !== secret) {
    res.status(401).send('Unauthorized')
    return false
  }
  return true
}

export const createGenericMigrationHandler = (
  rpcMethodName: string,
  app: Probot,
  secret: string | undefined,
  migrationsRpc: {
    invoke: (method: string, ...args: any[]) => Promise<any>
    dispose: () => Promise<void>
  },
) => {
  return async (req: Request, res: Response): Promise<void> => {
    if (!verifySecret(req, res, secret)) {
      return
    }

    const repository = req.query.repository
    if (!repository) {
      res.status(400).send('Missing repository parameter')
      return
    }
    if (typeof repository !== 'string' || !repository.includes('/')) {
      res.status(400).send('Invalid repository parameter')
      return
    }

    const [owner, repo] = repository.split('/')
    const baseBranch = (req.query.baseBranch as string) || 'main'

    try {
      // Authenticate as app to discover the installation for the repository
      let appOctokit
      try {
        appOctokit = await app.auth()
      } catch (error) {
        res.status(500).json({
          error: `Failed to authenticate app: ${error}`,
          code: 'AUTH_FAILED',
        })
        return
      }

      let installation
      try {
        const response = await appOctokit.rest.apps.getRepoInstallation({
          owner,
          repo,
        })
        installation = response.data
      } catch (error: any) {
        if (error && error.status === 404) {
          res.status(404).json({
            error: `App not installed on ${owner}/${repo}`,
            code: 'INSTALLATION_NOT_FOUND',
          })
          return
        }
        res.status(500).json({
          error: `Failed to get installation for ${owner}/${repo}: ${error}`,
          code: 'INSTALLATION_ERROR',
        })
        return
      }

      let octokit
      try {
        octokit = await app.auth(installation.id)
      } catch (error) {
        res.status(500).json({
          error: `Failed to authenticate installation ${String(installation.id)}: ${error}`,
          code: 'INSTALLATION_AUTH_FAILED',
        })
        return
      }

      // Build RPC options from query parameters
      const rpcOptions: Record<string, any> = {
        repositoryOwner: owner,
        repositoryName: repo,
      }

      // Add optional query parameters
      if (req.query.tagName && typeof req.query.tagName === 'string') {
        rpcOptions.tagName = req.query.tagName
      }
      if (req.query.version && typeof req.query.version === 'string') {
        rpcOptions.newVersion = req.query.version
      }
      if (
        req.query.dependencyName &&
        typeof req.query.dependencyName === 'string'
      ) {
        rpcOptions.dependencyName = req.query.dependencyName
      }
      if (
        req.query.packageJsonPath &&
        typeof req.query.packageJsonPath === 'string'
      ) {
        rpcOptions.packageJsonPath = req.query.packageJsonPath
      }
      if (
        req.query.packageLockJsonPath &&
        typeof req.query.packageLockJsonPath === 'string'
      ) {
        rpcOptions.packageLockJsonPath = req.query.packageLockJsonPath
      }

      // Call the RPC function
      const rpcResult = (await migrationsRpc.invoke(
        rpcMethodName,
        rpcOptions,
      )) as RpcMigrationResult

      if (rpcResult.status === 'error') {
        // Check for special error codes that should return different status codes
        const statusCode =
          rpcResult.errorCode === 'DEPENDENCY_NOT_FOUND' ||
          rpcResult.errorCode === 'FORBIDDEN'
            ? 400
            : 424

        res.status(statusCode).json({
          error: `Failed to run ${rpcMethodName} migration`,
          details: rpcResult.errorMessage || 'Unknown error',
          code:
            rpcResult.errorCode ||
            `${rpcMethodName.toUpperCase()}_MIGRATION_FAILED`,
        })
        return
      }

      if (rpcResult.changedFiles.length === 0) {
        res.status(200).json({
          message: 'No changes needed',
          changedFiles: 0,
        })
        return
      }

      // Apply the migration result
      const commitMessage = rpcResult.pullRequestTitle
      const pullRequestTitle = rpcResult.pullRequestTitle
      // Convert camelCase to kebab-case for branch name
      const branchName = rpcMethodName
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
      const newBranch = `${branchName}-${Date.now()}`

      const result = await applyMigrationResult(
        {
          octokit,
          owner,
          repo,
          baseBranch,
          migrationsRpc,
        },
        rpcResult.changedFiles,
        pullRequestTitle,
        commitMessage,
        newBranch,
      )

      if (!result.success) {
        res.status(424).json({
          error: `Failed to apply ${rpcMethodName} migration`,
          details: result.error,
          code: `${rpcMethodName.toUpperCase()}_APPLY_FAILED`,
        })
        return
      }

      res.status(200).json({
        message:
          result.message || `${rpcMethodName} migration completed successfully`,
        changedFiles: result.changedFiles,
        newBranch: result.newBranch,
      })
    } catch (error) {
      res.status(424).json({
        error: `Failed to run ${rpcMethodName} migration`,
        details: error instanceof Error ? error.message : String(error),
        code: `${rpcMethodName.toUpperCase()}_MIGRATION_FAILED`,
      })
    }
  }
}
