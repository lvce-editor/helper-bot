import { NodeWorkerRpcParent } from '@lvce-editor/rpc'
import { createLazyRpc } from '@lvce-editor/rpc-registry'
import { githubWorkerUrl, githubWorkerUrlDev } from './githubWorkerUrl.ts'

const rpcId = 88

export const { invoke, setFactory } = createLazyRpc(rpcId)

const launchGithubWorker = async () => {
  const workerUrl = process.env.NODE_ENV === 'production' ? githubWorkerUrl : githubWorkerUrlDev
  const rpc = await NodeWorkerRpcParent.create({
    commandMap: {},
    path: workerUrl,
    stdio: 'inherit',
  })
  return rpc
}

setFactory(launchGithubWorker)
