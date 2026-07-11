import './errorHandling.ts'
import type { ApplicationFunctionOptions, Context, Probot } from 'probot'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleDependencies } from './dependencies.ts'
import { updateBuiltinExtensions } from './updateBuiltinExtensions.ts'
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
import * as PlannedReleaseBatch from './parts/PlannedReleaseBatch/PlannedReleaseBatch.ts'
import express from 'express'
import { getDependenciesConfig } from './getDependenciesConfig.ts'

const dependenciesConfig = getDependenciesConfig()
const dependencies = dependenciesConfig.dependencies
const handledReleases = new Set<string>()
const handledReleaseTtl = 10 * 60 * 1000
const handledReleaseTimeouts = new Map<string, NodeJS.Timeout>()

const getReleaseKey = (context: Context<'release'>): string => {
  const { payload } = context
  return `${payload.repository.full_name || `${payload.repository.owner.login}/${payload.repository.name}`}@${payload.release.id || payload.release.tag_name}`
}

const markReleaseHandled = (context: Context<'release'>): boolean => {
  const key = getReleaseKey(context)
  if (handledReleases.has(key)) {
    return false
  }
  handledReleases.add(key)
  const timeout = setTimeout(() => {
    handledReleases.delete(key)
    handledReleaseTimeouts.delete(key)
  }, handledReleaseTtl).unref()
  handledReleaseTimeouts.set(key, timeout)
  return true
}

export const resetHandledReleases = (): void => {
  for (const timeout of handledReleaseTimeouts.values()) {
    clearTimeout(timeout)
  }
  handledReleaseTimeouts.clear()
  handledReleases.clear()
}

const dispatchDependencyUpdate = async (app: Probot, dependency: any, owner: string, tagName: string): Promise<void> => {
  try {
    await dispatchMigrationWorkflow({
      app,
      migrationId: '/migrations2/update-specific-dependency',
      migrationOptions: {
        ...(dependency.asName && { asName: dependency.asName }),
        fromRepo: dependency.fromRepo,
        tagName,
        toFolder: dependency.toFolder,
        toRepo: dependency.toRepo,
      },
      targetRepository: `${owner}/${dependency.toRepo}`,
    })
  } catch (error) {
    captureException(error as Error)
  }
}

const updateRepositoryDependencies = async (context: Context<'release'>, app?: Probot) => {
  if (!app) {
    return
  }
  const { payload } = context
  const owner = payload.repository.owner.login
  const releasedRepo = payload.repository.name
  const tagName = payload.release.tag_name
  const matchingDependencies = dependencies.filter((dependency) => dependency.fromRepo === releasedRepo)
  const repository = `${owner}/${releasedRepo}`
  if (PlannedReleaseBatch.isPlannedReleasePending(repository, tagName)) {
    const pendingDependencies = matchingDependencies.filter((dependency) => dependency.toRepo === 'lvce-editor')
    const immediateDependencies = matchingDependencies.filter((dependency) => dependency.toRepo !== 'lvce-editor')
    PlannedReleaseBatch.addPendingDependencyUpdates(
      pendingDependencies.map((dependency) => ({
        ...(dependency.asName && { asName: dependency.asName }),
        fromRepo: dependency.fromRepo,
        tagName,
        toFolder: dependency.toFolder,
        toRepo: dependency.toRepo,
      })),
    )
    await Promise.all(immediateDependencies.map((dependency) => dispatchDependencyUpdate(app, dependency, owner, tagName)))
    return
  }
  await Promise.all(matchingDependencies.map((dependency) => dispatchDependencyUpdate(app, dependency, owner, tagName)))
}

const updateBuiltinExtensionsForRelease = async (context: Context<'release'>): Promise<void> => {
  const { payload } = context
  const repositoryName = payload.repository.name
  const tagName = payload.release.tag_name
  const repository = `${payload.repository.owner.login}/${repositoryName}`
  if (repositoryName !== 'renderer-process' && PlannedReleaseBatch.isPlannedReleasePending(repository, tagName)) {
    PlannedReleaseBatch.addPendingBuiltinExtensionUpdate({ repositoryName, tagName })
    return
  }
  await updateBuiltinExtensions(context)
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
  if (!markReleaseHandled(context)) {
    return
  }
  await Promise.all([updateBuiltinExtensionsForRelease(context), updateRepositoryDependencies(context, app), updateWebsiteConfig(context, app)])
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

export default (app: Probot, { addHandler }: ApplicationFunctionOptions) => {
  console.log('Application starting up...')
  console.log(`cpus: ${availableParallelism()}`)
  try {
    addHandler(createCustomRoutesHandler(app))
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'No server instance') {
      throw error
    }
  }
  app.on('release', (context) => handleReleaseReleased(context, app))
  app.on('workflow_run.completed', createHandleMigrationWorkflowRun({ app, processInBackground: true }) as any)
  console.log('Event handlers registered')
}
