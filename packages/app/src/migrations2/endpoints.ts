import type { Request, Response } from 'express'
import type { Context, Probot } from 'probot'
import { captureException } from '../errorHandling.ts'
import * as MigrationsWorker from '../migrationsWorker.ts'
import { VError } from '@lvce-editor/verror'
import { handleLogin } from '../auth/LoginEndpoint.ts'
import { handleLogout } from '../auth/LogoutEndpoint.ts'
import { requireAuth } from '../auth/AuthMiddleware.ts'
import { getLoginPageHtml } from '../auth/LoginPage.ts'
import { getProtectedPageHtml } from '../auth/ProtectedPage.ts'

export interface ChangedFile {
  readonly content: string
  readonly path: string
  readonly type?: 'created' | 'updated' | 'deleted'
}

export interface MigrationResult {
  readonly branchName?: string
  readonly changedFiles: ChangedFile[]
  readonly commitMessage?: string
  readonly data?: any
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly pullRequestTitle: string
  readonly status: 'success' | 'error'
  readonly statusCode: number
}

const verifySecret = (req: Request, res: Response, secret: string | undefined): boolean => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized')
    return false
  }
  const providedToken = authHeader.slice(7) // Remove 'Bearer ' prefix
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
    const { body } = req

    console.log('body is')
    console.log(body)

    if (!body) {
      res.status(400).json({
        code: 'MISSING_POST_BODY',
        error: 'Missing post body',
      })
      return
    }

    const { repository } = body
    if (!repository) {
      res.status(400).json({
        code: 'MISSING_REPOSITORY',
        error: 'Missing repository parameter',
      })
      return
    }
    if (typeof repository !== 'string' || !repository.includes('/')) {
      res.status(400).json({
        code: 'INVALID_REPOSITORY',
        error: 'Invalid repository parameter',
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

      // Get the installation token for GitHub API calls
      let githubToken
      try {
        const authToken: any = await octokit.auth({
          type: 'installation',
        })
        githubToken = typeof authToken === 'string' ? authToken : authToken.token
      } catch (error) {
        throw new VError(error, `Failed to authenticate`)
      }

      // Call migration worker with the command key and params
      const migrationParams = {
        githubToken,
        repositoryName: repo,
        repositoryOwner: owner,
        ...body,
      }
      const migrationResult = await MigrationsWorker.invoke(commandKey, migrationParams)

      // Check if the result is an error
      if (migrationResult.type === 'error') {
        console.error(migrationResult.error)
        res.status(500).json({
          code: 'MIGRATION_WORKER_ERROR',
          error: migrationResult.error,
        })
        return
      }

      // Check if this is a function result (has 'data' property) vs migration result (has 'changedFiles')
      if ('data' in migrationResult && !('changedFiles' in migrationResult)) {
        // This is a function result, just return the data
        res.status(200).json(migrationResult.data)
        return
      }

      // The RPC system returns the MigrationResult directly, no serialization needed
      const result: MigrationResult = migrationResult

      // Handle error result
      if (result.status === 'error') {
        res.status(result.statusCode || 500).json({
          code: result.errorCode || 'MIGRATION_ERROR',
          error: result.errorMessage || 'Migration failed',
        })
        return
      }

      // Handle success result
      if (result.changedFiles.length === 0) {
        res.status(200).json({
          ...(result.data !== undefined ? { data: result.data } : {}),
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

        // Get base branch reference and latest commit
        const baseRef = await octokit.rest.git.getRef({
          owner,
          ref: `heads/${baseBranch}`,
          repo,
        })

        const latestCommit = await octokit.rest.git.getCommit({
          owner,
          repo,
          commit_sha: baseRef.data.object.sha,
        })

        const startingCommitSha = latestCommit.data.sha

        // Collect files that actually changed and build tree entries
        const treeEntries: Array<{
          path: string
          mode: '100644'
          type: 'blob'
          content: string
        }> = []
        const filesToDelete: string[] = []

        for (const changedFile of result.changedFiles) {
          // Handle deleted files
          if (changedFile.type === 'deleted') {
            // Check if file exists
            try {
              await octokit.rest.repos.getContent({
                owner,
                path: changedFile.path,
                ref: baseBranch,
                repo,
              })
              filesToDelete.push(changedFile.path)
            } catch (error) {
              // File doesn't exist, nothing to delete
              // @ts-ignore
              if (error && error.status !== 404) {
                throw error
              }
            }
            continue
          }

          // For created/updated files, check if content actually changed
          let existingContent: string | null = null
          try {
            const fileContent = await octokit.rest.repos.getContent({
              owner,
              path: changedFile.path,
              ref: baseBranch,
              repo,
            })
            if ('content' in fileContent.data && typeof fileContent.data.content === 'string') {
              existingContent = Buffer.from(fileContent.data.content, 'base64').toString('utf8')
            }
          } catch (error) {
            // File doesn't exist, that's okay - we'll create it
            // @ts-ignore
            if (error && error.status !== 404) {
              throw error
            }
          }

          // Only add to tree if content actually changed
          if (existingContent === null || existingContent !== changedFile.content) {
            treeEntries.push({
              content: changedFile.content,
              mode: '100644',
              path: changedFile.path,
              type: 'blob',
            })
          }
        }

        // If there are no actual changes (all files unchanged), return early
        if (treeEntries.length === 0 && filesToDelete.length === 0) {
          res.status(200).json({
            ...(result.data !== undefined ? { data: result.data } : {}),
            changedFiles: 0,
            message: 'Migration completed successfully with no changes',
            status: 'success',
          })
          return
        }

        // Create new branch pointing to base commit
        await octokit.rest.git.createRef({
          owner,
          ref: `refs/heads/${branchName}`,
          repo,
          sha: startingCommitSha,
        })

        // Create tree with all changes
        // When using base_tree, files not specified remain unchanged
        // To delete files, we need to get the full tree and exclude deleted files
        let newTreeSha: string
        if (filesToDelete.length > 0) {
          // Get the current tree recursively to handle deletions
          const currentTree = await octokit.rest.git.getTree({
            owner,
            repo,
            // @ts-ignore - recursive parameter type issue in octokit types
            recursive: 1,
            tree_sha: latestCommit.data.tree.sha,
          })

          // Build a map of paths to update (from treeEntries)
          const pathsToUpdate = new Set(treeEntries.map((entry) => entry.path))
          const pathsToDelete = new Set(filesToDelete)

          // Filter tree: exclude deleted files, and replace updated files
          const existingTreeEntries = currentTree.data.tree
            .filter((entry) => entry.type === 'blob' && !pathsToDelete.has(entry.path) && !pathsToUpdate.has(entry.path))
            .map((entry) => ({
              mode: entry.mode as '100644',
              path: entry.path,
              sha: entry.sha,
              type: entry.type as 'blob',
            }))

          // Combine: existing files (minus deletions and updates) + new/updated files
          const allTreeEntries = [...existingTreeEntries, ...treeEntries]

          const newTree = await octokit.rest.git.createTree({
            base_tree: latestCommit.data.tree.sha,
            owner,
            repo,
            tree: allTreeEntries,
          })
          newTreeSha = newTree.data.sha
        } else {
          // No deletions, just create tree with new/updated files using base_tree
          const newTree = await octokit.rest.git.createTree({
            base_tree: latestCommit.data.tree.sha,
            owner,
            repo,
            tree: treeEntries,
          })
          newTreeSha = newTree.data.sha
        }

        // Create a single commit with all changes
        const commit = await octokit.rest.git.createCommit({
          message: commitMessage,
          owner,
          parents: [startingCommitSha],
          repo,
          tree: newTreeSha,
        })

        // Update branch to point to new commit
        await octokit.rest.git.updateRef({
          owner,
          ref: `heads/${branchName}`,
          repo,
          sha: commit.data.sha,
        })

        // Create pull request
        const pullRequestData = await octokit.rest.pulls.create({
          base: baseBranch,
          head: branchName,
          owner,
          repo,
          title: result.pullRequestTitle,
        })

        // Enable auto merge squash
        await enableAutoSquash(octokit, pullRequestData)

        res.status(result.statusCode || 200).json({
          branchName,
          changedFiles: treeEntries.length + filesToDelete.length,
          ...(result.data !== undefined ? { data: result.data } : {}),
          message: 'Migration completed successfully',
          pullRequestNumber: pullRequestData.data.number,
          status: 'success',
        })
        return
      }

      // Success but no repository provided or no changed files
      res.status(200).json({
        changedFiles: result.changedFiles.length,
        ...(result.data !== undefined ? { data: result.data } : {}),
        message: 'Migration completed successfully',
        status: 'success',
      })
    } catch (error) {
      console.error(error)
      captureException(error as Error)
      res.status(500).json({
        code: 'MIGRATION_ENDPOINT_ERROR',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export const registerAuthEndpoints = (router: any, secret: string | undefined): void => {
  // Auth routes
  router.get('/login', (req: Request, res: Response) => {
    res.send(getLoginPageHtml())
  })
  router.post('/login', handleLogin(secret))
  router.get('/logout', handleLogout())
  router.get('/protected', requireAuth(secret), (req: Request, res: Response) => {
    res.send(getProtectedPageHtml())
  })
  console.log('Registered auth endpoints: /login, /logout, /protected')
}

export const registerMigrations2Endpoints = async (router: any, app: Probot, secret: string | undefined) => {
  // Register auth endpoints
  registerAuthEndpoints(router, secret)

  // Migrations2 endpoints - dynamically registered
  try {
    const commandsResult = await MigrationsWorker.invoke('/meta/list-commands-2')
    const commands: string[] = commandsResult

    // Filter commands that start with /migrations2
    const migrations2Commands = commands.filter((cmd: string) => cmd.startsWith('/migrations2') || cmd.startsWith('/multi-migrations'))

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
