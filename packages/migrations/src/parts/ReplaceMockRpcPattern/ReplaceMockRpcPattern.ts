const RE_RPC = /const\s+rpc\s*=\s*(RendererWorker|EditorWorker|TextSearchWorker|FileSearchWorker|IframeWorker|VirtualDom)\.registerMockRpc/g

export const replaceMockRpcPattern = (content: string): string => {
  return content.replaceAll(RE_RPC, 'using rpc = $1.registerMockRpc')
}
