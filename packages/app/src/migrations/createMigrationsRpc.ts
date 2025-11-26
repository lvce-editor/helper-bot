import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { NodeWorkerRpcParent } from '@lvce-editor/rpc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const createMigrationsRpc = async (): Promise<{
  invoke: (method: string, ...args: any[]) => Promise<any>
  dispose: () => Promise<void>
}> => {
  const migrationsWorkerPath = join(__dirname, '../../migrations/src/index.ts')

  const rpc = await NodeWorkerRpcParent.create({
    commandMap: {},
    path: migrationsWorkerPath,
    stdio: 'pipe',
  })

  return {
    invoke: async (method: string, ...args: any[]): Promise<any> => {
      return await rpc.invoke(method, ...args)
    },
    dispose: async (): Promise<void> => {
      await rpc.dispose()
    },
  }
}
