import { availableParallelism } from 'node:os'
import { Context, Probot } from 'probot'
import { handleDependencies } from './dependencies.js'
import { captureException } from '../migrations/src/index.js'
import { createGenericMigrationHandler } from './migrations/createGenericMigrationHandler.js'
import { createMigrationsRpc } from './migrations/createMigrationsRpc.js'
import {
  getAvailableMigrations,
  MIGRATION_MAP,
} from './migrations/getAvailableMigrations.js'
import { updateBuiltinExtensions } from './updateBuiltinExtensions.js'
import dependenciesConfig from './dependencies.json' with { type: 'json' }
import { updateDependencies } from './updateDependencies.js'

const dependencies = dependenciesConfig.dependencies

const updateRepositoryDependencies = async (context: Context<'release'>) => {
  const { payload } = context
  const tagName = payload.release.tag_name
  const owner = payload.repository.owner.login
  const repositoryName = payload.repository.name

  const migrationsRpc = await createMigrationsRpc()

  try {
    await migrationsRpc.invoke('updateRepositoryDependencies', {
      repositoryOwner: owner,
      repositoryName,
      tagName,
    })
  } catch (error) {
    captureException(error as Error)
  }

  // Call updateDependencies for each matching dependency
  for (const dependency of dependencies) {
    if (dependency.fromRepo === repositoryName) {
      try {
        await updateDependencies(context, dependency)
      } catch (error) {
        captureException(error as Error)
      }
    }
  }
}

const handleReleaseReleased = async (context: Context<'release'>) => {
  await Promise.all([
    updateBuiltinExtensions(context),
    updateRepositoryDependencies(context),
  ])
}

const handleHelloWorld = (req: any, res: any) => {
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

  // Create RPC connection to migrations worker
  const migrationsRpc = await createMigrationsRpc()

  router.post(
    '/update-dependencies',
    handleDependencies({
      app,
      installationId,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )

  // Get available migrations and register them dynamically
  const availableMigrations = await getAvailableMigrations(migrationsRpc)
  console.log(
    `Available RPC commands: ${availableMigrations.allRpcCommands.join(', ')}`,
  )
  console.log(`Migrations: ${availableMigrations.migrations.join(', ')}`)
  console.log(`Special migrations: ${availableMigrations.special.join(', ')}`)

  // Register all migrations dynamically (1:1 mapping to RPC functions)
  for (const endpointName of availableMigrations.migrations) {
    const rpcMethodName = MIGRATION_MAP[endpointName]
    if (rpcMethodName) {
      router.post(
        `/migrations/${endpointName}`,
        createGenericMigrationHandler(
          rpcMethodName,
          app,
          process.env.DEPENDENCIES_SECRET,
          migrationsRpc,
        ),
      )
      console.log(
        `Registered migration endpoint: /migrations/${endpointName} -> ${rpcMethodName}`,
      )
    }
  }
}

export default (app: Probot, { getRouter }: any) => {
  console.log('Application starting up...')
  console.log(`cpus: ${availableParallelism()}`)
  enableCustomRoutes(app, getRouter)
  app.on('release.released', handleReleaseReleased)

  console.log('Event handlers registered')
}
