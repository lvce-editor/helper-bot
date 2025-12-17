import './errorHandling.js'
import { Context, Probot } from 'probot'
import { handleDependencies } from './dependencies.js'
import { updateBuiltinExtensions } from './updateBuiltinExtensions.js'
import { updateDependencies } from './updateDependencies.js'
import dependenciesConfig from './dependencies.json' with { type: 'json' }
import { captureException } from './errorHandling.js'
import { availableParallelism } from 'node:os'
import { handleUpdateGithubActions } from './updateGithubActionsEndpoint.js'
import {
  handleUpdateNodeVersion,
  handleUpdateDependencies,
  handleEnsureLernaExcluded,
  handleUpdateGithubActions as handleUpdateGithubActionsMigration,
  handleAddGitattributes,
  handleAddOidcPermissions,
  handleRemoveNpmToken,
} from './migrations/endpoints.js'
import * as MigrationsWorker from './migrationsWorker.js'

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

const handleReleaseReleased = async (context: Context<'release'>) => {
  await Promise.all([updateBuiltinExtensions(context), updateRepositoryDependencies(context)])
}

const handleHelloWorld = async (req: any, res: any) => {
  const result = await MigrationsWorker.invoke('/hello-world')
  if (result.type === 'error') {
    res.send(result.error)
  } else {
    res.send(result.text)
  }
  res.send('Hello World')
}

const enableCustomRoutes = async (app: Probot, getRouter: any) => {
  if (!getRouter || typeof getRouter !== 'function') {
    return
  }
  const router = getRouter('/my-app')

  router.get('/hello-world', handleHelloWorld)

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
}

export default (app: Probot, { getRouter }: any) => {
  console.log('Application starting up...')
  console.log(`cpus: ${availableParallelism()}`)
  enableCustomRoutes(app, getRouter)
  app.on('release.released', handleReleaseReleased)
  // app.on('check_suite.completed', (context) => {
  //   console.log('Check suite completed event received')
  //   console.log('Event payload:', JSON.stringify(context.payload, null, 2))
  //   console.log(`Received check suite: ${context.payload.repository.full_name}`)
  //   const authorizedCommitter = process.env.AUTHORIZED_COMMITTER
  //   console.log('Authorized committer:', authorizedCommitter)
  //   if (!authorizedCommitter) {
  //     console.log('No authorized committer set')
  //     return
  //   }
  //   return handleCheckRun(context, authorizedCommitter)
  // })
  console.log('Event handlers registered')
}
