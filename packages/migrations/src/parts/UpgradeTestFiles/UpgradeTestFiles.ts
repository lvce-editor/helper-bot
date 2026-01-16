import type * as FsPromises from 'node:fs/promises'
import { replaceMockRpcPattern } from '../ReplaceMockRpcPattern.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

const findTestFiles = async (clonedRepoUri: string, fs: typeof FsPromises): Promise<string[]> => {
  const testFiles: string[] = []
  const testDirectories = ['packages/app/test', 'packages/exec-worker/test', 'packages/github-worker/test', 'packages/migrations/test']

  for (const testDir of testDirectories) {
    try {
      const testDirUri = new URL(normalizePath(testDir), clonedRepoUri).toString()
      const entries = await fs.readdir(testDirUri)

      for (const entry of entries) {
        if (entry.endsWith('.test.ts') || entry.endsWith('.test.js')) {
          testFiles.push(normalizePath(`${testDir}/${entry}`))
        }
      }
    } catch {
      // Skip directories that don't exist
      continue
    }
  }

  return testFiles
}

export const upgradeTestFiles = async (clonedRepoUri: string, fs: typeof FsPromises): Promise<Array<{ path: string; content: string }>> => {
  const changedFiles: Array<{ path: string; content: string }> = []

  const entries = await findTestFiles(clonedRepoUri, fs)
  for (const entry of entries) {
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.js')) {
      const testFilePath = normalizePath(entry)
      const testFileUri = new URL(testFilePath, clonedRepoUri).toString()

      try {
        const content = await fs.readFile(testFileUri, 'utf8')

        const newContent = replaceMockRpcPattern(content)

        if (newContent !== content) {
          await fs.writeFile(testFileUri, newContent)
          changedFiles.push({
            content: newContent,
            path: testFilePath,
          })
        }
      } catch {
        // Skip files that can't be read or written
        continue
      }
    }
  }

  return changedFiles
}
