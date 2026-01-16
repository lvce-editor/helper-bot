export const replaceMockRpcPattern = (content: string): string => {
  // Replace const rpc = RendererWorker.registerMockRpc with using rpc = RendererWorker.registerMockRpc
  // This pattern matches: const + whitespace + rpc + whitespace + = + whitespace + RendererWorker.registerMockRpc
  return content.replaceAll(/const\s+rpc\s*=\s*RendererWorker\.registerMockRpc/g, 'using rpc = RendererWorker.registerMockRpc')
}
