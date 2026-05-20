import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Migration, MigrationParams, MigrationResult } from './types.ts'
import { createPullRequest } from '../createPullRequest.ts'

const GITATTRIBUTES_CONTENT = '* text=auto eol=lf\n'

export const checkAndAddGitattributes = async (root: string): Promise<boolean> => {
  const gitattributesPath = join(root, '.gitattributes')

  try {
    await readFile(gitattributesPath, 'utf8')
    return false
  } catch {
    try {
      await access(root)
    } catch {
      return false
    }
    try {
      await writeFile(gitattributesPath, GITATTRIBUTES_CONTENT, 'utf8')
      return true
    } catch (writeError) {
      console.warn('Failed to create .gitattributes file:', writeError)
      return false
    }
  }
}

export const addGitattributesMigration: Migration = {
  description: 'Add .gitattributes file with text=auto eol=lf if missing',
  name: 'addGitattributes',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { baseBranch = 'main', octokit, owner, repo } = params

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
            message: '.gitattributes file already exists',
            success: true,
          }
        }

        // Check for changes
        const { stdout } = await execa('git', ['status', '--porcelain'], {
          cwd: tempDir,
        })

        if (!stdout) {
          return {
            message: 'No changes needed',
            success: true,
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
          baseBranch,
          commitableFiles: [], // Files are already committed
          commitMessage: 'ci: add .gitattributes file',
          newBranch,
          octokit,
          owner,
          pullRequestTitle: 'ci: add .gitattributes file',
          repo,
        })

        return {
          changedFiles,
          message: '.gitattributes file added successfully',
          newBranch,
          success: true,
        }
      } finally {
        await rm(tempDir, { force: true, recursive: true })
      }
    } catch (error) {
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      return {
        error: errorMessage,
        success: false,
      }
    }
  },
}
