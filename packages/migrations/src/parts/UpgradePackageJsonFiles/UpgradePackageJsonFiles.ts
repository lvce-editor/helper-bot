import type * as FsPromises from 'node:fs/promises'
import type { ExecFunction } from '../Types/Types.ts'
import { findPackageJsonFiles } from '../FindPackageJsonFiles/FindPackageJsonFiles.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'
import { updatePackageJsonDependencies } from '../UpdatePackageJsonDependencies/UpdatePackageJsonDependencies.ts'
import { uriToPath } from '../UriUtils/UriUtils.ts'

export const upgradePackageJsonFiles = async (
  clonedRepoUri: string,
  fs: Readonly<typeof FsPromises & { exists: (path: string | Buffer | URL) => Promise<boolean> }>,
  exec: ExecFunction,
  latestRpcVersion: string,
  latestRpcRegistryVersion: string,
): Promise<Array<{ path: string; content: string }>> => {
  const changedFiles: Array<{ path: string; content: string }> = []

  try {
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
          // Get relative path from clonedRepoUri using URL pathname
          const repoUrl = new URL(clonedRepoUri)
          const fileUrl = new URL(packageJsonUri)
          const relativePath = fileUrl.pathname.replace(repoUrl.pathname, '').replace(/^\//, '')

          // Write updated package.json back
          const updatedPackageJsonContent = stringifyJson(packageJson)
          await fs.writeFile(packageJsonUri, updatedPackageJsonContent, 'utf8')

          // Run npm install to update package-lock.json
          try {
            const packageJsonDirUri = new URL('.', packageJsonUri).toString().replace(/\/$/, '')
            const packageJsonDir = uriToPath(packageJsonDirUri)
            await exec('npm', ['install', '--ignore-scripts', '--prefer-online'], {
              cwd: packageJsonDir,
            })

            // Read updated package-lock.json
            const packageLockJsonUri = packageJsonUri.replace('package.json', 'package-lock.json')
            const packageLockJsonExists = await fs.exists(packageLockJsonUri)
            if (packageLockJsonExists) {
              const packageLockJsonContent = await fs.readFile(packageLockJsonUri, 'utf8')
              const packageLockJsonPath = relativePath.replace('package.json', 'package-lock.json')
              changedFiles.push({
                content: packageLockJsonContent,
                path: packageLockJsonPath,
              })
            }
          } catch {
            // If npm install fails, continue without package-lock.json
            // The package.json will still be updated
          }

          changedFiles.push({
            content: updatedPackageJsonContent,
            path: relativePath,
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
