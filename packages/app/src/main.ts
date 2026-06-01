import { run, type ApplicationFunction } from 'probot'
import { fileURLToPath } from 'node:url'
import app from './index.ts'

const getServerEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  if (env.HOST || env.NODE_ENV !== 'production') {
    return env
  }
  return {
    ...env,
    HOST: '0.0.0.0',
  }
}

export const main = async (
  runApp: (appFnOrArgv: ApplicationFunction | string[], additionalOptions?: { env?: NodeJS.ProcessEnv }) => Promise<unknown> = run,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> => {
  await runApp(app, { env: getServerEnv(env) })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
