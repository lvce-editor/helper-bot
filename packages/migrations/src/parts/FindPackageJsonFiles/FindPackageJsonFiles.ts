import type * as FsPromises from 'node:fs/promises'
import { listFiles } from '../ListFiles/ListFiles.ts'

export const findPackageJsonFiles = async (clonedRepoUri: string, fs: Readonly<typeof FsPromises>): Promise<string[]> => {
  const allFiles = await listFiles(clonedRepoUri, fs)
  const packageJsonFiles = allFiles.filter((file) => file.endsWith('package.json'))
  return packageJsonFiles
}
