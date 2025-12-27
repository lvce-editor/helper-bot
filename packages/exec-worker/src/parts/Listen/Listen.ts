import { NodeWorkerRpcClient } from '@lvce-editor/rpc'
import { commandMap } from '../CommandMap/CommandMap.ts'
import { commandMapRef } from '../CommandMapRef/CommandMapRef.ts'

export const listen = async (): Promise<void> => {
  Object.assign(commandMapRef, commandMap)
  await NodeWorkerRpcClient.create({
    commandMap,
  })
}
