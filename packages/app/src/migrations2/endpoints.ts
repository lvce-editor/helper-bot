import type { Request, Response } from 'express'
import type { Probot } from 'probot'
import { timingSafeEqual } from 'node:crypto'
import { captureException } from '../errorHandling.ts'
import { dispatchMigrationWorkflow } from '../parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts'
import {
  assertAllowedTargetRepository,
  assertSafeMigrationOptions,
  isValidBaseBranch,
  parseTargetRepository,
} from '../parts/MigrationSecurity/MigrationSecurity.ts'

export const migrations2RoutePatterns = ['/migrations2/*', '/multi-migrations/*'] as const

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}

const isGithubActionsUnavailableError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 500
}

const verifySecret = (req: Request, res: Response, secret: string | undefined): boolean => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized')
    return false
  }
  const providedToken = authHeader.slice(7) // Remove 'Bearer ' prefix
  if (!secret) {
    res.status(401).send('Unauthorized')
    return false
  }
  const providedTokenBuffer = Buffer.from(providedToken)
  const secretBuffer = Buffer.from(secret)
  if (providedTokenBuffer.length !== secretBuffer.length || !timingSafeEqual(providedTokenBuffer, secretBuffer)) {
    res.status(401).send('Unauthorized')
    return false
  }
  return true
}

export const createMigrations2Handler = ({ app, secret }: { app: Probot; secret: string | undefined }) => {
  return async (req: Request, res: Response): Promise<void> => {
    if (!verifySecret(req, res, secret)) {
      return
    }
    const { body } = req

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
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
    if (typeof repository !== 'string' || !parseTargetRepository(repository)) {
      res.status(400).json({
        code: 'INVALID_REPOSITORY',
        error: 'Invalid repository parameter',
      })
      return
    }
    try {
      assertAllowedTargetRepository(repository)
    } catch (error) {
      res.status(403).json({
        code: 'FORBIDDEN_REPOSITORY',
        error: getErrorMessage(error),
      })
      return
    }

    try {
      const commandKey = req.path
      const { baseBranch } = body
      const migrationOptions = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'baseBranch' && key !== 'repository'))
      if (baseBranch !== undefined && (typeof baseBranch !== 'string' || !isValidBaseBranch(baseBranch))) {
        res.status(400).json({
          code: 'INVALID_BASE_BRANCH',
          error: 'Invalid baseBranch parameter',
        })
        return
      }
      assertSafeMigrationOptions(migrationOptions)
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
      if (error instanceof Error && error.message.includes('looks like a secret')) {
        res.status(400).json({
          code: 'SENSITIVE_MIGRATION_OPTION',
          error: error.message,
        })
        return
      }
      console.error(error)
      captureException(error as Error)
      if (isGithubActionsUnavailableError(error)) {
        res.status(500).json({
          code: 'E_GITHUB_ACTIONS_UNAVAILABLE',
          error: 'Migration failed because Github Actions is currently unavailble',
        })
        return
      }
      res.status(500).json({
        code: 'MIGRATION_ENDPOINT_ERROR',
        error: getErrorMessage(error),
      })
    }
  }
}

export const registerMigrations2Endpoints = async (router: any, app: Probot, secret: string | undefined): Promise<void> => {
  const handler = createMigrations2Handler({
    app,
    secret,
  })
  router.post(/^\/migrations2\/.+$/, handler)
  router.post(/^\/multi-migrations\/.+$/, handler)
}
