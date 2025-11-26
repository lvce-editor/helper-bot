import { NodeWorkerRpcClient } from '@lvce-editor/rpc'
import { commandMap } from '../CommandMap/CommandMap.ts'

export const listen = async (): Promise<void> => {
  await NodeWorkerRpcClient.create({
    commandMap,
  })
}
