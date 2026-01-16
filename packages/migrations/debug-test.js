const { createMockNpmFetch } = require('./src/parts/CreateMockNpmFetch/CreateMockNpmFetch.ts')
const { getLatestNpmVersion } = require('./src/parts/GetLatestNpmVersion/GetLatestNpmVersion.ts')

async function test() {
  const mockFetch = createMockNpmFetch({
    '@lvce-editor/rpc': '5.0.0',
    '@lvce-editor/rpc-registry': '7.0.0',
  })

  try {
    const rpcVersion = await getLatestNpmVersion('@lvce-editor/rpc', mockFetch)
    console.log('RPC version:', rpcVersion)
    
    const registryVersion = await getLatestNpmVersion('@lvce-editor/rpc-registry', mockFetch)
    console.log('Registry version:', registryVersion)
  } catch (error) {
    console.error('Error:', error.message)
  }
}

test()
