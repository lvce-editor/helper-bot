import './errorHandling.ts'
import type { ApplicationFunctionOptions, Context, Probot } from 'probot'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleDependencies } from './dependencies.ts'
import { updateBuiltinExtensions } from './updateBuiltinExtensions.ts'
import { updateDependencies } from './updateDependencies.ts'
import { captureException } from './errorHandling.ts'
import { availableParallelism } from 'node:os'
import { handleUpdateGithubActions } from './updateGithubActionsEndpoint.ts'
import {
  handleUpdateNodeVersion,
  handleUpdateDependencies,
  handleEnsureLernaExcluded,
  handleUpdateGithubActions as handleUpdateGithubActionsMigration,
  handleAddGitattributes,
  handleAddOidcPermissions,
  handleRemoveNpmToken,
} from './migrations/endpoints.ts'
import { migrations2RoutePatterns, registerMigrations2Endpoints } from './migrations2/endpoints.ts'
import { dispatchMigrationWorkflow } from './parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts'
import { createHandleMigrationWorkflowRun } from './parts/HandleMigrationWorkflowRun/HandleMigrationWorkflowRun.ts'
import express from 'express'
import { getDependenciesConfig } from './getDependenciesConfig.ts'

const dependencies = getDependenciesConfig().dependencies

const updateRepositoryDependencies = async (context: Context<'release'>) => {
  for (const dependency of dependencies) {
    try {
      await updateDependencies(context, dependency)
    } catch (error) {
      captureException(error as Error)
    }
  }
}

const updateWebsiteConfig = async (context: Context<'release'>, app?: Probot) => {
  const { payload } = context
  const releasedRepo = payload.repository.name

  // Only trigger update-website-config for lvce-editor releases
  if (releasedRepo !== 'lvce-editor') {
    return
  }

  try {
    await dispatchMigrationWorkflow({
      // @ts-ignore
      app,
      migrationId: '/migrations2/update-website-config',
      migrationOptions: {
        releasedTag: payload.release.tag_name,
      },
      targetRepository: 'lvce-editor/lvce-editor.github.io',
    })
  } catch (error) {
    captureException(error as Error)
  }
}

export const shouldHandleRelease = (context: Context<'release'>): boolean => {
  const { action, release } = context.payload
  if (release.draft || release.prerelease) {
    return false
  }
  return action === 'created' || action === 'published' || action === 'released'
}

export const handleReleaseReleased = async (context: Context<'release'>, app?: Probot) => {
  if (!shouldHandleRelease(context)) {
    return
  }
  await Promise.all([updateBuiltinExtensions(context), updateRepositoryDependencies(context), updateWebsiteConfig(context, app)])
}

const handleHelloWorld = async (req: any, res: any) => {
  res.send('Hello World')
}

const handleMigrationsList = async (req: any, res: any) => {
  res.json([...migrations2RoutePatterns])
}

type CustomRouteHandler = (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>

const createCustomRoutesHandler = (app: Probot): CustomRouteHandler => {
  const server = express()
  const router = express.Router()

  router.use(express.json())
  router.get('/hello-world', handleHelloWorld)
  router.get('/migrations/list', handleMigrationsList)

  const installationIdString = process.env.INSTALLATION_ID
  const installationId = installationIdString ? parseInt(installationIdString, 10) : undefined

  router.post(
    '/update-dependencies',
    handleDependencies({
      app,
      installationId,
      // @ts-ignore
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  router.post(
    '/update-github-actions',
    handleUpdateGithubActions({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  // Migration endpoints
  router.post(
    '/migrations/update-node-version',
    handleUpdateNodeVersion({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  router.post(
    '/migrations/update-dependencies',
    handleUpdateDependencies({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  router.post(
    '/migrations/ensure-lerna-excluded',
    handleEnsureLernaExcluded({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  router.post(
    '/migrations/update-github-actions',
    handleUpdateGithubActionsMigration({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  router.post(
    '/migrations/add-gitattributes',
    handleAddGitattributes({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  router.post(
    '/migrations/add-oidc-permissions',
    handleAddOidcPermissions({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  router.post(
    '/migrations/remove-npm-token',
    handleRemoveNpmToken({
      app,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  // Migrations2 endpoints - dynamically registered
  registerMigrations2Endpoints(router, app, process.env.DEPENDENCIES_SECRET)

  server.use('/my-app', router)

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || ''
    if (url !== '/my-app' && !url.startsWith('/my-app/')) {
      return false
    }

    await new Promise<void>((resolve, reject) => {
      server(req as any, res as any, (error?: unknown) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    return true
  }
}

export default (app: Probot, options: ApplicationFunctionOptions) => {
  console.log('Application starting up...')
  console.log(`cpus: ${availableParallelism()}`)
  const addHandler = 'addHandler' in options ? options.addHandler : undefined
  if (typeof addHandler === 'function') {
    try {
      addHandler(createCustomRoutesHandler(app))
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'No server instance') {
        throw error
      }
    }
  }
  app.on('release', (context) => handleReleaseReleased(context, app))
  app.on('workflow_run.completed', createHandleMigrationWorkflowRun({ app }) as any)
  console.log('Event handlers registered')
}
