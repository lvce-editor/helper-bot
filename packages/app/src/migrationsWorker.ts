import { NodeWorkerRpcParent } from '@lvce-editor/rpc'
import { createLazyRpc } from '@lvce-editor/rpc-registry'
import { migrationsWorkerUrl, migrationsWorkerUrlDev } from './migrationsWorkerUrl.ts'

const rpcId = 87

export const { invoke, setFactory } = createLazyRpc(rpcId)

const launchMigrationsWorker = async () => {
  const workerUrl = process.env.NODE_ENV === 'production' ? migrationsWorkerUrl : migrationsWorkerUrlDev
  const rpc = await NodeWorkerRpcParent.create({
    commandMap: {},
    path: workerUrl,
    stdio: 'inherit',
  })
  return rpc
}

setFactory(launchMigrationsWorker)
