import { availableParallelism } from 'node:os'
import { Context, Probot } from 'probot'
import { handleDependencies } from './dependencies.js'
import { createGenericMigrationHandler } from './migrations/createGenericMigrationHandler.js'
import { createMigrationsRpc } from './migrations/createMigrationsRpc.js'
import {
  getAvailableMigrations,
  MIGRATION_MAP,
} from './migrations/getAvailableMigrations.js'
import { applyMigrationResult } from './migrations/applyMigrationResult.js'
import dependenciesConfig from './dependencies.json' with { type: 'json' }
import { updateDependencies } from './updateDependencies.js'
import { captureException, cloneRepositoryTmp } from '../migrations/src/index.js'

const dependencies = dependenciesConfig.dependencies

const handleReleaseReleased = async (context: Context<'release'>) => {
  const { payload, octokit } = context
  const tagName = payload.release.tag_name
  const owner = payload.repository.owner.login
  const repositoryName = payload.repository.name

  const migrationsRpc = await createMigrationsRpc()

  try {
    // Call handleReleaseReleased migration
    await migrationsRpc.invoke('handleReleaseReleased', {
      repositoryOwner: owner,
      repositoryName,
      tagName,
    })

    // Handle updateBuiltinExtensions separately since it updates a different repo
    if (repositoryName !== 'renderer-process') {
      const targetOwner = owner
      const targetRepo = 'lvce-editor'
      const targetFilePath =
        'packages/build/src/parts/DownloadBuiltinExtensions/builtinExtensions.json'

      // Clone the target repo
      const clonedRepo = await cloneRepositoryTmp(targetOwner, targetRepo)

      try {
        const updateResult = await migrationsRpc.invoke('updateBuiltinExtensions', {
          repositoryOwner: targetOwner,
          repositoryName: targetRepo,
          tagName,
          releasedRepositoryName: repositoryName,
          targetFilePath,
          clonedRepoPath: clonedRepo.path,
          fs: (await import('node:fs/promises')).default,
          fetch: globalThis.fetch,
          exec: async (
            file: string,
            args?: readonly string[],
            options?: { cwd?: string },
          ) => {
            const { execa } = await import('execa')
            const result = await execa(file, args as string[], options)
            return {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode ?? 0,
            }
          },
        })

        if (
          updateResult.status === 'success' &&
          updateResult.changedFiles.length > 0
        ) {
          // Apply the migration result to the target repo
          const version = tagName.replace('v', '')
          const newBranch = `update-version/${repositoryName}-${tagName}`
          const commitMessage = `feature: update ${repositoryName} to version ${tagName}`

          await applyMigrationResult(
            {
              octokit,
              owner: targetOwner,
              repo: targetRepo,
              baseBranch: 'main',
              migrationsRpc,
            },
            updateResult.changedFiles,
            updateResult.pullRequestTitle,
            commitMessage,
            newBranch,
          )
        }
      } finally {
        await clonedRepo[Symbol.asyncDispose]()
      }
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
  } catch (error) {
    captureException(error as Error)
  }
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
