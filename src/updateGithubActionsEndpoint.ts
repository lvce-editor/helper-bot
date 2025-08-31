import type { Request, Response } from 'express'
import type { Probot } from 'probot'
import { updateGithubActions } from './updateGithubActions.js'

const verifySecret = (
  req: Request,
  res: Response,
  secret: string | undefined,
): boolean => {
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
      const appOctokit = await app.auth()
      const { data: installation } =
        await appOctokit.rest.apps.getRepoInstallation({
          owner,
          repo,
        })
      // Authenticate as the installation
      const octokit = await app.auth(installation.id)
      const result = await updateGithubActions({
        octokit,
        owner,
        repo,
        osVersions: {
          ubuntu: '24.04',
          windows: '2025',
          macos: '15',
        },
      })
      if (!result || result.changedFiles === 0) {
        res.status(200).send('No workflow updates needed')
        return
      }
      res.status(200).send('GitHub Actions update PR created successfully')
    } catch (error) {
      // @ts-ignore
      if (error && error.status === 404) {
        res.status(404).send('App is not installed on repository')
        return
      }
      res.status(424).json({
        error: 'Failed to update GitHub Actions',
        // @ts-ignore
        details: error.message,
        code: 'GITHUB_ACTIONS_UPDATE_FAILED',
      })
    }
  }
