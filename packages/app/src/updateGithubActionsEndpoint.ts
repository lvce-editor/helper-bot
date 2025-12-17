import type { Request, Response } from 'express'
import type { Probot } from 'probot'
import { VError } from '@lvce-editor/verror'
import { updateGithubActions } from './updateGithubActions.ts'

const verifySecret = (req: Request, res: Response, secret: string | undefined): boolean => {
  const providedSecret = req.query.secret
  if (!secret || providedSecret !== secret) {
    res.status(401).send('Unauthorized')
    return false
  }
  return true
}

export const handleUpdateGithubActions =
  ({ app, secret }: { app: Probot; secret: string | undefined }) =>
  async (req: Request, res: Response) => {
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
          throw new VError(error as Error, `app not installed on ${owner}/${repo} (missing installation)`)
        }
        throw new VError(error as Error, `failed to get installation for ${owner}/${repo}`)
      }
      let octokit
      try {
        octokit = await app.auth(installation.id)
      } catch (error) {
        throw new VError(error as Error, `failed to authenticate installation ${String(installation.id)} for ${owner}/${repo}`)
      }
      let result
      try {
        result = await updateGithubActions({
          octokit,
          owner,
          repo,
          osVersions: {
            ubuntu: '24.04',
            windows: '2025',
            macos: '15',
          },
        })
      } catch (error) {
        throw new VError(error as Error, `failed to update workflows in ${owner}/${repo}`)
      }
      if (!result || result.changedFiles === 0) {
        res.status(200).send('No workflow updates needed')
        return
      }
      res.status(200).send('GitHub Actions update PR created successfully')
    } catch (error) {
      res.status(424).json({
        error: 'Failed to update GitHub Actions',
        details: error instanceof Error ? error.message : String(error),
        code: 'GITHUB_ACTIONS_UPDATE_FAILED',
      })
    }
  }
