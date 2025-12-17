import type { Request, Response } from 'express'
import { Context, Probot } from 'probot'
import { captureException } from '../errorHandling.js'
import * as MigrationsWorker from '../migrationsWorker.js'

export interface ChangedFile {
  readonly content: string
  readonly path: string
}

export interface MigrationResult {
  readonly changedFiles: ChangedFile[]
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly pullRequestTitle: string
  readonly status: 'success' | 'error'
  readonly statusCode: number
  readonly branchName?: string
  readonly commitMessage?: string
}

const verifySecret = (req: Request, res: Response, secret: string | undefined): boolean => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized')
    return false
  }
  const providedToken = authHeader.substring(7) // Remove 'Bearer ' prefix
  if (providedToken !== secret) {
    res.status(401).send('Unauthorized')
    return false
  }
  return true
}

const enableAutoSquash = async (octokit: Context<'release'>['octokit'], pullRequestData: { data: { node_id: string } }) => {
  await octokit.graphql(
    `mutation MyMutation {
      enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
        clientMutationId
      }
    }`,
  )
}

export const createMigrations2Handler = (commandKey: string, { app, secret }: { app: Probot; secret: string | undefined }) => {
  return async (req: Request, res: Response) => {
    if (!verifySecret(req, res, secret)) {
      return
    }

    const body: any = req.body

    if (!body) {
      res.status(400).json({
        error: 'Missing post body',
        code: 'MISSING_POST_BODY',
      })
      return
    }

    console.log('body is')
    console.log(body)

    const repository = body.repository
    if (!repository) {
      res.status(400).json({
        error: 'Missing repository parameter',
        code: 'MISSING_REPOSITORY',
      })
      return
    }
    if (typeof repository !== 'string' || !repository.includes('/')) {
      res.status(400).json({
        error: 'Invalid repository parameter',
        code: 'INVALID_REPOSITORY',
      })
      return
    }

    const [owner, repo] = repository.split('/')
    try {
      // Authenticate as app to discover the installation for the repository
      let appOctokit
      try {
        appOctokit = await app.auth()
      } catch (error) {
        throw new Error(`failed to authenticate app: ${error}`)
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
          throw new Error(`app not installed on ${owner}/${repo} (missing installation)`)
        }
        throw new Error(`failed to get installation for ${owner}/${repo}: ${error}`)
      }
      let octokit
      try {
        octokit = await app.auth(installation.id)
      } catch (error) {
        throw new Error(`failed to authenticate installation ${String(installation.id)} for ${owner}/${repo}: ${error}`)
      }

      // Call migration worker with the command key and params
      const migrationParams = {
        repositoryOwner: owner,
        repositoryName: repo,
        ...body,
      }
      const migrationResult = await MigrationsWorker.invoke(commandKey, migrationParams)

      // Check if the result is an error
      if (migrationResult.type === 'error') {
        res.status(500).json({
          error: migrationResult.error,
          code: 'MIGRATION_WORKER_ERROR',
        })
        return
      }

      // The RPC system returns the MigrationResult directly, no serialization needed
      const result: MigrationResult = migrationResult.text

      // Handle error result
      if (result.status === 'error') {
        res.status(result.statusCode || 500).json({
          error: result.errorMessage || 'Migration failed',
          code: result.errorCode || 'MIGRATION_ERROR',
        })
        return
      }

      // Handle success result
      if (result.changedFiles.length === 0) {
        res.status(200).json({
          message: 'Migration completed successfully with no changes',
          status: 'success',
        })
        return
      }

      // If there are changed files and repository is provided, create branch, update files, and create PR
      if (result.changedFiles.length > 0 && repository) {
        const baseBranch = body.baseBranch || 'main'
        const branchName = result.branchName || `migration-${Date.now()}`
        const commitMessage = result.commitMessage || result.pullRequestTitle

        // Get base branch reference
        const baseRef = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${baseBranch}`,
        })

        // Create new branch
        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseRef.data.object.sha,
        })

        // Update each changed file
        for (const changedFile of result.changedFiles) {
          // Try to get existing file to get its SHA
          let fileSha: string | undefined
          try {
            const fileContent = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: changedFile.path,
              ref: baseBranch,
            })
            if ('sha' in fileContent.data) {
              fileSha = fileContent.data.sha
            }
          } catch (error) {
            // File doesn't exist, that's okay - we'll create it without SHA
            // @ts-ignore
            if (error && error.status !== 404) {
              throw error
            }
          }

          // Encode content to base64
          const encodedContent = Buffer.from(changedFile.content).toString('base64')

          // Update or create the file
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: changedFile.path,
            message: commitMessage,
            content: encodedContent,
            branch: branchName,
            ...(fileSha ? { sha: fileSha } : {}),
          })
        }

        // Create pull request
        const pullRequestData = await octokit.rest.pulls.create({
          owner,
          repo,
          head: branchName,
          base: baseBranch,
          title: result.pullRequestTitle,
        })

        // Enable auto merge squash
        await enableAutoSquash(octokit, pullRequestData)

        res.status(200).json({
          message: 'Migration completed successfully',
          status: 'success',
          branchName,
          pullRequestNumber: pullRequestData.data.number,
          changedFiles: result.changedFiles.length,
        })
        return
      }

      // Success but no repository provided or no changed files
      res.status(200).json({
        message: 'Migration completed successfully',
        status: 'success',
        changedFiles: result.changedFiles.length,
      })
    } catch (error) {
      captureException(error as Error)
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        code: 'MIGRATION_ENDPOINT_ERROR',
      })
    }
  }
}

export const registerMigrations2Endpoints = async (router: any, app: Probot, secret: string | undefined) => {
  // Migrations2 endpoints - dynamically registered
  try {
    const commandsResult = await MigrationsWorker.invoke('/meta/list-commands-2')
    let commands: string[] = commandsResult

    // Filter commands that start with /migrations2
    const migrations2Commands = commands.filter((cmd: string) => cmd.startsWith('/migrations2'))

    // Register each migrations2 command as an endpoint
    for (const commandKey of migrations2Commands) {
      // Convert /migrations2/command-name to /migrations2/command-name endpoint
      const endpointPath = commandKey
      router.post(
        endpointPath,
        createMigrations2Handler(commandKey, {
          app,
          secret,
        }),
      )
      console.log(`Registered migrations2 endpoint: ${endpointPath}`)
    }
  } catch (error) {
    console.error('Failed to register migrations2 endpoints:', error)
    process.exit(1)
  }
}
