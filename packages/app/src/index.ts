import { availableParallelism } from 'node:os'
import { Probot } from 'probot'
import { enableCustomRoutes } from './enableCustomRoutes.js'

export default (app: Probot, { getRouter }: any) => {
  console.log('Application starting up...')
  console.log(`cpus: ${availableParallelism()}`)
  enableCustomRoutes(app, getRouter)

  console.log('Event handlers registered')
}
