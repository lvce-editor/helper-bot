import type * as FsPromises from 'node:fs/promises'
import { findTestFiles } from '../FindTestFiles/FindTestFiles.ts'
import { replaceMockRpcPattern } from '../ReplaceMockRpcPattern/ReplaceMockRpcPattern.ts'
import { uriToPath } from '../UriUtils/UriUtils.ts'

export const upgradeTestFiles = async (clonedRepoUri: string, fs: Readonly<typeof FsPromises>): Promise<Array<{ path: string; content: string }>> => {
  const changedFiles: Array<{ path: string; content: string }> = []

  try {
    // Convert URI to path for directory traversal
    const repoPath = uriToPath(clonedRepoUri)
    const testFiles = await findTestFiles(clonedRepoUri, fs)

    for (const testFileUri of testFiles) {
      try {
        // Read test file content
        const content = await fs.readFile(testFileUri, 'utf8')

        // Replace 'const mockRpc =' with 'using mockRpc =' for proper disposal
        const updatedContent = replaceMockRpcPattern(content)

        // Only add to changed files if content was actually modified
        if (updatedContent !== content) {
          // Convert URI to path, then to relative path from repo root
          const testFilePath = uriToPath(testFileUri)
          const relativePath = testFilePath.replace(repoPath + '/', '').replace(/^\//, '')
          const normalizedPath = relativePath.replaceAll('\\', '/')

          changedFiles.push({
            content: updatedContent,
            path: normalizedPath,
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
