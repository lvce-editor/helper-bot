import type * as FsPromises from 'node:fs/promises'
import { listFiles } from '../ListFiles/ListFiles.ts'

export const findTestFiles = async (clonedRepoUri: string, fs: Readonly<typeof FsPromises>): Promise<string[]> => {
  const allFiles = await listFiles(clonedRepoUri, fs)
  const testFiles = allFiles.filter((file) => 
    file.endsWith('.test.ts') ||
    file.endsWith('.test.js') ||
    file.endsWith('.spec.ts') ||
    file.endsWith('.spec.js') ||
    file.includes('.test.') ||
    file.includes('.spec.')
  )
  return testFiles
}
