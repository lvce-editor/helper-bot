import { availableParallelism } from 'node:os'
import { Context, Probot } from 'probot'
import { handleDependencies } from './dependencies.js'
import { createGenericMigrationHandler } from './migrations/createGenericMigrationHandler.js'
import { createMigrationsRpc } from './migrations/createMigrationsRpc.js'
import { getAvailableMigrations } from './migrations/getAvailableMigrations.js'
import { applyMigrationResult } from './migrations/applyMigrationResult.js'
import dependenciesConfig from './dependencies.json' with { type: 'json' }
import { updateDependencies } from './updateDependencies.js'

const dependencies = dependenciesConfig.dependencies

const handleReleaseReleased = async (context: Context<'release'>) => {
  const { payload, octokit } = context
  const tagName = payload.release.tag_name
  const owner = payload.repository.owner.login
  const repositoryName = payload.repository.name

  const migrationsRpc = await createMigrationsRpc()

  try {
    // Clone the target repo for builtin extensions update if needed
    let clonedRepo: Awaited<ReturnType<typeof cloneRepositoryTmp>> | null = null
    let targetOwner: string | undefined
    let targetRepo: string | undefined
    let targetFilePath: string | undefined

    if (repositoryName !== 'renderer-process') {
      targetOwner = owner
      targetRepo = 'lvce-editor'
      targetFilePath =
        'packages/build/src/parts/DownloadBuiltinExtensions/builtinExtensions.json'

      clonedRepo = await cloneRepositoryTmp(targetOwner, targetRepo)
    }

    try {
      // Call handleReleaseReleased migration with all necessary options
      const migrationResult = await migrationsRpc.invoke(
        'migrations/handle-release-released',
        {
          repositoryOwner: owner,
          repositoryName,
          tagName,
          targetOwner,
          targetRepo,
          targetFilePath,
          clonedRepoPath: clonedRepo?.path,
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
        },
      )

      // Apply builtin extensions changes if any
      if (
        migrationResult.status === 'success' &&
        migrationResult.changedFiles.length > 0 &&
        targetOwner &&
        targetRepo
      ) {
        // Filter changed files for builtin extensions (they have the target file path)
        const builtinExtensionsFiles = migrationResult.changedFiles.filter(
          (file) => file.path === targetFilePath,
        )

        if (builtinExtensionsFiles.length > 0) {
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
            builtinExtensionsFiles,
            migrationResult.pullRequestTitle,
            commitMessage,
            newBranch,
          )
        }
      }
    } finally {
      if (clonedRepo) {
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
    const rpcMethodName = `migrations/${endpointName}`
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

export default (app: Probot, { getRouter }: any) => {
  console.log('Application starting up...')
  console.log(`cpus: ${availableParallelism()}`)
  enableCustomRoutes(app, getRouter)
  app.on('release.released', handleReleaseReleased)

  console.log('Event handlers registered')
}
