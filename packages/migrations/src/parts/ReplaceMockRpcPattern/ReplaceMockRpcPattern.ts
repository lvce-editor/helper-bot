const RE_RPC = /const\s+(\w+)\s*=\s*(.*)\.registerMockRpc/g

export const replaceMockRpcPattern = (content: string): string => {
  return content.replaceAll(RE_RPC, 'using $1 = $2.registerMockRpc')
}
