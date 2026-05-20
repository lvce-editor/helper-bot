import type { Request, Response } from 'express'
import type { Probot } from 'probot'
import { captureException } from '../errorHandling.ts'
import * as MigrationsWorker from '../migrationsWorker.ts'
import { dispatchMigrationWorkflow } from '../parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts'

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

    try {
      const { repository: ignoredRepository, baseBranch, ...migrationOptions } = body
      const dispatchResult = await dispatchMigrationWorkflow({
        app,
        baseBranch: baseBranch || 'main',
        migrationId: commandKey,
        migrationOptions,
        targetRepository: repository,
      })
      res.status(202).json({
        message: 'Migration workflow dispatched successfully',
        requestId: dispatchResult.requestId,
        status: 'queued',
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

export const registerMigrations2Endpoints = async (router: any, app: Probot, secret: string | undefined) => {
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
