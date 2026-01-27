import './errorHandling.ts'
import type { ApplicationFunctionOptions, Context, Probot } from 'probot'
import { handleDependencies } from './dependencies.ts'
import { updateBuiltinExtensions } from './updateBuiltinExtensions.ts'
import { updateDependencies } from './updateDependencies.ts'
import dependenciesConfig from './dependencies.json' with { type: 'json' }
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
import { registerMigrations2Endpoints } from './migrations2/endpoints.ts'
import * as MigrationsWorker from './migrationsWorker.ts'
import bodyParser from 'body-parser'

const dependencies = dependenciesConfig.dependencies

const updateRepositoryDependencies = async (context: Context<'release'>) => {
  for (const dependency of dependencies) {
    try {
      await updateDependencies(context, dependency)
    } catch (error) {
      captureException(error as Error)
    }
  }
}

const updateWebsiteConfig = async (context: Context<'release'>) => {
  const { payload } = context
  const releasedRepo = payload.repository.name
  
  // Only trigger update-website-config for lvce-editor releases
  if (releasedRepo !== 'lvce-editor') {
    return
  }

  try {
    const githubToken = context.token
    const migrationParams = {
      githubToken,
      repositoryName: 'lvce-editor.github.io',
      repositoryOwner: 'lvce-editor',
    }
    await MigrationsWorker.invoke('/migrations2/update-website-config', migrationParams)
  } catch (error) {
    captureException(error as Error)
  }
}

const handleReleaseReleased = async (context: Context<'release'>) => {
  await Promise.all([
    updateBuiltinExtensions(context),
    updateRepositoryDependencies(context),
    updateWebsiteConfig(context),
  ])
}

const send = (res: any, result: any) => {
  if (result.type === 'error') {
    res.send(result.error)
  } else {
    res.send(result.text)
  }
}

const handleHelloWorld = async (req: any, res: any) => {
  const result = await MigrationsWorker.invoke('/hello-world')
  send(res, result)
}

const handleMigrationsList = async (req: any, res: any) => {
  const result = await MigrationsWorker.invoke('/migrations2/list')
  send(res, result)
}

const enableCustomRoutes = async (app: Probot, getRouter: ApplicationFunctionOptions['getRouter']) => {
  if (!getRouter || typeof getRouter !== 'function') {
    return
  }
  const router = getRouter('/my-app')

  router.use(bodyParser.json())
  router.get('/hello-world', handleHelloWorld)
  router.get('/migrations/list', handleMigrationsList)

  const installationIdString = process.env.INSTALLATION_ID
  if (!installationIdString) {
    throw new Error('installation id not found')
  }
  const installationId = parseInt(installationIdString)

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
  await registerMigrations2Endpoints(router, app, process.env.DEPENDENCIES_SECRET)
}

export default (app: Probot, { getRouter }: ApplicationFunctionOptions) => {
  console.log('Application starting up...')
  console.log(`cpus: ${availableParallelism()}`)
  enableCustomRoutes(app, getRouter)
  app.on('release.released', handleReleaseReleased)
  console.log('Event handlers registered')
}
