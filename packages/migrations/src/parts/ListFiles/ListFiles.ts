import type * as FsPromises from 'node:fs/promises'

export const listFiles = async (uri: string, fs: typeof FsPromises): Promise<readonly string[]> => {
  const rootEntries = await fs.readdir(uri, { recursive: true })
  const filtered = rootEntries.filter((file) => !file.includes('node_modules') && !file.includes('.git'))
  return filtered
}
