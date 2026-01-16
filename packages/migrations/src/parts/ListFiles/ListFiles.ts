import type * as FsPromises from 'node:fs/promises'
import { pathToUri } from '../UriUtils/UriUtils.ts'

export const listFiles = async (uri: string, fs: typeof FsPromises): Promise<readonly string[]> => {
  const rootEntries = await fs.readdir(uri, { recursive: true })
  console.log('listFiles - uri:', uri)
  console.log('listFiles - rootEntries:', rootEntries)
  const filtered = rootEntries.filter((file) => !file.includes('node_modules') && !file.includes('.git'))
  // Convert relative paths to full URIs
  const baseUri = uri.endsWith('/') ? uri : uri + '/'
  const fullUris = filtered.map((file) => pathToUri(baseUri + file))
  console.log('listFiles - fullUris:', fullUris)
  return fullUris
}
