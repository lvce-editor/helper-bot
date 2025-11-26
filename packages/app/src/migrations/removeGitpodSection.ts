import { join } from 'node:path'
import { createPullRequest } from '../createPullRequest.js'
import type { Migration, MigrationParams, MigrationResult } from './types.js'

const removeGitpodSection = async (readmePath: string): Promise<boolean> => {
  try {
    const { readFile, writeFile } = await import('node:fs/promises')
    const content = await readFile(readmePath, 'utf-8')

    // Pattern to match Gitpod sections in README
    // This matches sections that start with ## Gitpod or similar headers
    // and includes content until the next header or end of file
    const gitpodPattern = /^#{1,6}\s*[Gg]itpod.*?(?=^#{1,6}\s|\Z)/gms

    const updatedContent = content.replace(gitpodPattern, '')

    // Only write if content actually changed
    if (content !== updatedContent) {
      await writeFile(readmePath, updatedContent)
      return true
    }

    return false
  } catch (error) {
    // File doesn't exist or can't be read, skip
    return false
  }
}

const updateReadmeFiles = async (root: string): Promise<boolean> => {
  const readmePaths = [
    'README.md',
    'readme.md',
    'Readme.md',
    'README.MD',
    'readme.MD',
  ]

  let hasChanges = false

  for (const readmePath of readmePaths) {
    const fullPath = join(root, readmePath)
    const changed = await removeGitpodSection(fullPath)
    if (changed) {
      hasChanges = true
    }
  }

  return hasChanges
}

export const removeGitpodSectionMigration: Migration = {
  name: 'removeGitpodSection',
  description:
    'Remove Gitpod sections from README files since Gitpod has shut down',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { octokit, owner, repo, baseBranch = 'main' } = params

      // Create a temporary directory to clone the repo
      const { mkdtemp, rm } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { execa } = await import('execa')

      const tempDir = await mkdtemp(join(tmpdir(), 'remove-gitpod-section-'))

      try {
        // Clone the repository
        await execa('git', [
          'clone',
          `https://github.com/${owner}/${repo}.git`,
          tempDir,
        ])

        // Update README files
        const hasChanges = await updateReadmeFiles(tempDir)

        if (!hasChanges) {
          return {
            success: true,
            message: 'No Gitpod sections found in README files',
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
        const newBranch = `remove-gitpod-section-${Date.now()}`
        await execa('git', ['checkout', '-b', newBranch], { cwd: tempDir })
        await execa('git', ['add', '.'], { cwd: tempDir })
        await execa(
          'git',
          ['commit', '-m', 'ci: remove Gitpod section from README'],
          { cwd: tempDir },
        )
        await execa('git', ['push', 'origin', newBranch], { cwd: tempDir })

        // Create pull request
        const changedFiles = stdout.split('\n').filter(Boolean).length
        await createPullRequest({
          octokit,
          baseBranch,
          newBranch,
          commitableFiles: [], // Files are already committed
          commitMessage: 'ci: remove Gitpod section from README',
          owner,
          pullRequestTitle: 'ci: remove Gitpod section from README',
          repo,
        })

        return {
          success: true,
          changedFiles,
          newBranch,
          message: 'Gitpod sections removed from README files',
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
