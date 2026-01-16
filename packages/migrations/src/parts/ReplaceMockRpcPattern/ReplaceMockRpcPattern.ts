export const replaceMockRpcPattern = (content: string): string => {
  // Replace const rpc = Worker.registerMockRpc with using rpc = Worker.registerMockRpc
  // This pattern matches: const + whitespace + rpc + whitespace + = + whitespace + WorkerName.registerMockRpc
  // Supports: RendererWorker, EditorWorker, TextSearchWorker, FileSearchWorker, IframeWorker, VirtualDom
  return content.replaceAll(
    /const\s+rpc\s*=\s*(RendererWorker|EditorWorker|TextSearchWorker|FileSearchWorker|IframeWorker|VirtualDom)\.registerMockRpc/g,
    'using rpc = $1.registerMockRpc'
  )
}
