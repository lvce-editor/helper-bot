import type { Request, Response } from 'express'
import { VError } from '@lvce-editor/verror'
import { updateNodeVersionMigration } from './updateNodeVersion.js'
import { updateDependenciesMigration } from './updateDependencies.js'
import { ensureLernaExcludedMigration } from './ensureLernaExcluded.js'
import { updateGithubActionsMigration } from './updateGithubActions.js'
import { addGitattributesMigration } from './addGitattributes.js'
import type { MigrationEndpointParams } from './types.js'

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

const createMigrationHandler = (
  migration: any,
  { app, secret }: MigrationEndpointParams,
) => {
  return async (req: Request, res: Response) => {
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
    try {
      // Authenticate as app to discover the installation for the repository
      let appOctokit
      try {
        appOctokit = await app.auth()
      } catch (error) {
        throw new VError(error as Error, 'failed to authenticate app')
      }
      let installation
      try {
        const response = await appOctokit.rest.apps.getRepoInstallation({
          owner,
          repo,
        })
        installation = response.data
      } catch (error) {
        // @ts-ignore
        if (error && error.status === 404) {
          throw new VError(
            error as Error,
            `app not installed on ${owner}/${repo} (missing installation)`,
          )
        }
        throw new VError(
          error as Error,
          `failed to get installation for ${owner}/${repo}`,
        )
      }
      let octokit
      try {
        octokit = await app.auth(installation.id)
      } catch (error) {
        throw new VError(
          error as Error,
          `failed to authenticate installation ${String(installation.id)} for ${owner}/${repo}`,
        )
      }

      const result = await migration.run({
        octokit,
        owner,
        repo,
        baseBranch: (req.query.baseBranch as string) || 'main',
      })

      if (!result.success) {
        res.status(424).json({
          error: `Failed to run ${migration.name} migration`,
          details: result.error,
          code: `${migration.name.toUpperCase()}_MIGRATION_FAILED`,
        })
        return
      }

      res.status(200).json({
        message:
          result.message ||
          `${migration.name} migration completed successfully`,
        changedFiles: result.changedFiles,
        newBranch: result.newBranch,
      })
    } catch (error) {
      res.status(424).json({
        error: `Failed to run ${migration.name} migration`,
        details: error instanceof Error ? error.message : String(error),
        code: `${migration.name.toUpperCase()}_MIGRATION_FAILED`,
      })
    }
  }
}

export const handleUpdateNodeVersion = (params: MigrationEndpointParams) =>
  createMigrationHandler(updateNodeVersionMigration, params)

export const handleUpdateDependencies = (params: MigrationEndpointParams) =>
  createMigrationHandler(updateDependenciesMigration, params)

export const handleEnsureLernaExcluded = (params: MigrationEndpointParams) =>
  createMigrationHandler(ensureLernaExcludedMigration, params)

export const handleUpdateGithubActions = (params: MigrationEndpointParams) =>
  createMigrationHandler(updateGithubActionsMigration, params)

export const handleAddGitattributes = (params: MigrationEndpointParams) =>
  createMigrationHandler(addGitattributesMigration, params)
