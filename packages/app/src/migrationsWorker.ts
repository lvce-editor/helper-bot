import { NodeWorkerRpcParent } from '@lvce-editor/rpc'
import { createLazyRpc } from '@lvce-editor/rpc-registry'
import { migrationsWorkerUrl } from './migrationsWorkerUrl.js'

const rpcId = 87

export const { invoke, setFactory } = createLazyRpc(rpcId)

const launchMigrationsWorker = async () => {
  const rpc = await NodeWorkerRpcParent.create({
    commandMap: {},
    path: migrationsWorkerUrl,
  })
  return rpc
}

setFactory(launchMigrationsWorker)
