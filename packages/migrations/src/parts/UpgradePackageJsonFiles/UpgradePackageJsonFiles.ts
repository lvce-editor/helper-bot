import type * as FsPromises from 'node:fs/promises'
import { findPackageJsonFiles } from '../FindPackageJsonFiles/FindPackageJsonFiles.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { updatePackageJsonDependencies } from '../UpdatePackageJsonDependencies/UpdatePackageJsonDependencies.ts'
import { uriToPath } from '../UriUtils/UriUtils.ts'

export const upgradePackageJsonFiles = async (
  clonedRepoUri: string,
  fs: Readonly<typeof FsPromises>,
  latestRpcVersion: string,
  latestRpcRegistryVersion: string,
): Promise<Array<{ path: string; content: string }>> => {
  const changedFiles: Array<{ path: string; content: string }> = []

  try {
    // Convert URI to path for directory traversal
    const repoPath = uriToPath(clonedRepoUri)
    const packageJsonFiles = await findPackageJsonFiles(clonedRepoUri, fs)

    for (const packageJsonUri of packageJsonFiles) {
      try {
        // Read package.json content
        const content = await fs.readFile(packageJsonUri, 'utf8')
        const packageJson = JSON.parse(content)

        // Update dependencies
        const updated = updatePackageJsonDependencies({
          latestRpcRegistryVersion,
          latestRpcVersion,
          packageJson,
        })

        if (updated) {
          // Convert URI to path, then to relative path from repo root
          const packageJsonPath = uriToPath(packageJsonUri)
          const relativePath = packageJsonPath.replace(repoPath + '/', '')
          const normalizedPath = relativePath.replaceAll('\\', '/')

          changedFiles.push({
            content: stringifyJson(packageJson),
            path: normalizedPath,
          })
        }
      } catch {
        // Skip files that can't be parsed or read
        continue
      }
    }
  } catch {
    // If we can't traverse the directory, return empty array
  }

  return changedFiles
}
