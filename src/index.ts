import { Context, Probot } from 'probot'
import { handleDependencies } from './dependencies.js'
import { updateBuiltinExtensions } from './updateBuiltinExtensions.js'
import { updateDependencies } from './updateDependencies.js'
import { handleCheckRun } from './handleCheckRun.js'
import dependenciesConfig from './dependencies.json' with { type: 'json' }

const dependencies = dependenciesConfig.dependencies

const updateRepositoryDependencies = async (context: Context<'release'>) => {
  for (const dependency of dependencies) {
    try {
      await updateDependencies(context, dependency)
    } catch (error) {
      console.error(error)
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

  router.post(
    '/update-dependencies',
    handleDependencies({
      app,
      installationId,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )
}

export default (app: Probot, { getRouter }: any) => {
  enableCustomRoutes(app, getRouter)
  app.on('release.released', handleReleaseReleased)
  app.on('check_run.completed', (context) => {
    console.log(`Received check run: ${context.payload.repository.full_name}`)
    const authorizedCommitter = process.env.AUTHORIZED_COMMITTER
    if (!authorizedCommitter) {
      return
    }
    return handleCheckRun(context, authorizedCommitter)
  })
}
