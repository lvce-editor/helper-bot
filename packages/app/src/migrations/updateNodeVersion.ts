import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPullRequest } from '../createPullRequest.js'
import type { Migration, MigrationParams, MigrationResult } from './types.js'

interface NodeVersion {
  version: string
  lts: string | false
}

const getLatestNodeVersion = async (): Promise<string> => {
  const response = await fetch('https://nodejs.org/dist/index.json')
  // @ts-ignore
  const versions: NodeVersion[] = await response.json()
  const latestLts = versions.find((version) => version.lts)
  if (!latestLts) {
    throw new Error('No LTS version found')
  }
  return latestLts.version
}

const parseVersion = (content: string): number => {
  if (content.startsWith('v')) {
    return parseInt(content.slice(1))
  }
  return parseInt(content)
}

const updateNvmrc = async (newVersion: string, root: string): Promise<boolean> => {
  try {
    const nvmrcPath = join(root, '.nvmrc')
    const content = await readFile(nvmrcPath, 'utf-8')
    const existingVersionNumber = parseVersion(content)
    const newVersionNumber = parseVersion(newVersion)
    if (existingVersionNumber > newVersionNumber) {
      return false
    }
    await writeFile(nvmrcPath, `${newVersion}\n`)
  } catch (error) {
    // File doesn't exist, skip
  }
  return true
}

const updateDockerfile = async (newVersion: string, root: string): Promise<void> => {
  try {
    const dockerfilePath = join(root, 'Dockerfile')
    const content = await readFile(dockerfilePath, 'utf-8')
    const updated = content.replaceAll(/node:\d+\.\d+\.\d+/g, `node:${newVersion.slice(1)}`)
    await writeFile(dockerfilePath, updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

const updateGitpodDockerfile = async (newVersion: string, root: string): Promise<void> => {
  try {
    const gitpodPath = join(root, '.gitpod.Dockerfile')
    const content = await readFile(gitpodPath, 'utf-8')
    const updated = content.replaceAll(/(nvm [\w\s]+) \d+\.\d+\.\d+/g, `$1 ${newVersion.slice(1)}`)
    await writeFile(gitpodPath, updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

const updateNodeVersionFiles = async (newVersion: string, root: string): Promise<boolean> => {
  const shouldContinueUpdating = await updateNvmrc(newVersion, root)
  if (!shouldContinueUpdating) {
    return false
  }
  await Promise.all([updateDockerfile(newVersion, root), updateGitpodDockerfile(newVersion, root)])
  return true
}

export const updateNodeVersionMigration: Migration = {
  name: 'updateNodeVersion',
  description: 'Update Node.js version in .nvmrc, Dockerfile, and .gitpod.Dockerfile',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { octokit, owner, repo, baseBranch = 'main' } = params

      // Get the latest Node.js version
      const newVersion = await getLatestNodeVersion()

      // Create a temporary directory to clone the repo
      const { mkdtemp } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { execa } = await import('execa')
      const { rm } = await import('node:fs/promises')

      const tempDir = await mkdtemp(join(tmpdir(), 'update-node-version-'))

      try {
        // Clone the repository
        await execa('git', ['clone', `https://github.com/${owner}/${repo}.git`, tempDir])

        // Update files
        const hasChanges = await updateNodeVersionFiles(newVersion, tempDir)

        if (!hasChanges) {
          return {
            success: true,
            message: 'Node version is already up to date',
          }
        }

        // Check for changes
        const { stdout } = await execa('git', ['status', '--porcelain'], {
          cwd: tempDir,
        })

        if (!stdout) {
          return {
            success: true,
            message: 'No changes needed',
          }
        }

        // Create new branch and commit
        const newBranch = `update-node-version-${Date.now()}`
        await execa('git', ['checkout', '-b', newBranch], { cwd: tempDir })
        await execa('git', ['add', '.'], { cwd: tempDir })
        await execa('git', ['commit', '-m', `ci: update Node.js to version ${newVersion}`], { cwd: tempDir })
        await execa('git', ['push', 'origin', newBranch], { cwd: tempDir })

        // Create pull request
        const changedFiles = stdout.split('\n').filter(Boolean).length
        await createPullRequest({
          octokit,
          baseBranch,
          newBranch,
          commitableFiles: [], // Files are already committed
          commitMessage: `ci: update Node.js to version ${newVersion}`,
          owner,
          pullRequestTitle: `ci: update Node.js to version ${newVersion}`,
          repo,
        })

        return {
          success: true,
          changedFiles,
          newBranch,
          message: `Node.js version updated to ${newVersion}`,
        }
      } finally {
        // Clean up temporary directory
        await rm(tempDir, { recursive: true, force: true })
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
