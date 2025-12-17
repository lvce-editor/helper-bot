import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPullRequest } from '../createPullRequest.js'
import type { Migration, MigrationParams, MigrationResult } from './types.js'

const GITATTRIBUTES_CONTENT = '* text=auto eol=lf\n'

export const checkAndAddGitattributes = async (root: string): Promise<boolean> => {
  const gitattributesPath = join(root, '.gitattributes')

  try {
    // Check if .gitattributes already exists
    await readFile(gitattributesPath, 'utf8')
    console.log('.gitattributes file already exists')
    return false
  } catch (error) {
    // File doesn't exist, try to create it
    try {
      await writeFile(gitattributesPath, GITATTRIBUTES_CONTENT, 'utf8')
      console.log('Created .gitattributes file')
      return true
    } catch (writeError) {
      // Directory doesn't exist or other write error
      console.warn('Failed to create .gitattributes file:', writeError)
      return false
    }
  }
}

export const addGitattributesMigration: Migration = {
  name: 'addGitattributes',
  description: 'Add .gitattributes file with text=auto eol=lf if missing',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { octokit, owner, repo, baseBranch = 'main' } = params

      // Create a temporary directory to clone the repo
      const { mkdtemp } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { execa } = await import('execa')
      const { rm } = await import('node:fs/promises')

      const tempDir = await mkdtemp(join(tmpdir(), 'add-gitattributes-'))

      try {
        // Clone the repository
        await execa('git', ['clone', `https://github.com/${owner}/${repo}.git`, tempDir])

        // Check and add .gitattributes file
        const hasChanges = await checkAndAddGitattributes(tempDir)

        if (!hasChanges) {
          return {
            success: true,
            message: '.gitattributes file already exists',
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
        const newBranch = `add-gitattributes-${Date.now()}`
        await execa('git', ['checkout', '-b', newBranch], { cwd: tempDir })
        await execa('git', ['add', '.'], { cwd: tempDir })
        await execa('git', ['commit', '-m', 'ci: add .gitattributes file'], {
          cwd: tempDir,
        })
        await execa('git', ['push', 'origin', newBranch], { cwd: tempDir })

        // Create pull request
        const changedFiles = stdout.split('\n').filter(Boolean).length
        await createPullRequest({
          octokit,
          baseBranch,
          newBranch,
          commitableFiles: [], // Files are already committed
          commitMessage: 'ci: add .gitattributes file',
          owner,
          pullRequestTitle: 'ci: add .gitattributes file',
          repo,
        })

        return {
          success: true,
          changedFiles,
          newBranch,
          message: '.gitattributes file added successfully',
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
