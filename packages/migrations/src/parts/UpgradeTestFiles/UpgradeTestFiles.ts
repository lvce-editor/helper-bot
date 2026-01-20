import type * as FsPromises from 'node:fs/promises'
import { findTestFiles } from '../FindTestFiles/FindTestFiles.ts'
import { replaceMockRpcPattern } from '../ReplaceMockRpcPattern/ReplaceMockRpcPattern.ts'

export const upgradeTestFiles = async (clonedRepoUri: string, fs: Readonly<typeof FsPromises>): Promise<Array<{ path: string; content: string }>> => {
  const changedFiles: Array<{ path: string; content: string }> = []

  try {
    const testFiles = await findTestFiles(clonedRepoUri, fs)

    for (const testFileUri of testFiles) {
      try {
        // Read test file content
        const content = await fs.readFile(testFileUri, 'utf8')

        // Replace 'const mockRpc =' with 'using mockRpc =' for proper disposal
        const updatedContent = replaceMockRpcPattern(content)

        // Only add to changed files if content was actually modified
        if (updatedContent !== content) {
          // Get relative path from clonedRepoUri using URL pathname
          const repoUrl = new URL(clonedRepoUri)
          const fileUrl = new URL(testFileUri)
          const relativePath = fileUrl.pathname.replace(repoUrl.pathname, '').replace(/^\//, '')

          changedFiles.push({
            content: updatedContent,
            path: relativePath,
          })
        }
      } catch {
        // Skip files that can't be read
        continue
      }
    }
  } catch {
    // If we can't traverse the directory, return empty array
  }

  return changedFiles
}
