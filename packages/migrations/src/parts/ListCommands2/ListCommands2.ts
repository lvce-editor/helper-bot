import { commandMapRef } from '../CommandMapRef/CommandMapRef.ts'

export const listCommands2 = async (): Promise<readonly string[]> => {
  const keys = Object.keys(commandMapRef)
  const filtered = keys.filter((item) => !item.startsWith('/meta'))
  return filtered
}
