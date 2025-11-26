import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPullRequest } from '../createPullRequest.js'
import type { Migration, MigrationParams, MigrationResult } from './types.js'

const ensureLernaExcludedInFile = async (
  scriptPath: string,
): Promise<boolean> => {
  try {
    const scriptContent = await readFile(scriptPath, 'utf8')

    // Check if the script contains any ncu commands
    const ncuRegex = /OUTPUT=`ncu -u(.*?)`/g
    const matches = [...scriptContent.matchAll(ncuRegex)]

    if (matches.length === 0) {
      console.log('No ncu command found in update-dependencies.sh script')
      return false
    }

    let updatedContent = scriptContent
    let hasChanges = false

    // Process each ncu command
    for (const match of matches) {
      const ncuCommand = match[1]

      // Check if lerna is already excluded
      if (!ncuCommand.includes('-x lerna')) {
        // Add lerna to the exclusion list
        let updatedCommand: string
        if (ncuCommand.trim() === '') {
          // No existing exclusions
          updatedCommand = ' -x lerna'
        } else {
          // Has existing exclusions, add lerna to the end
          updatedCommand = ncuCommand.replace(
            /(-x [^-]+)+$/,
            (match) => `${match} -x lerna`,
          )
        }

        updatedContent = updatedContent.replace(
          match[0],
          `OUTPUT=\`ncu -u${updatedCommand}\``,
        )
        hasChanges = true
      }
    }

    if (hasChanges) {
      await writeFile(scriptPath, updatedContent, 'utf8')
      console.log('Added lerna exclusion to update-dependencies.sh script')
      return true
    } else {
      console.log('Lerna is already excluded in update-dependencies.sh script')
      return false
    }
  } catch (error) {
    console.warn('Failed to check/modify update-dependencies.sh script:', error)
    return false
  }
}

export const ensureLernaExcludedMigration: Migration = {
  name: 'ensureLernaExcluded',
  description:
    'Ensure lerna is excluded from ncu commands in update-dependencies.sh',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { octokit, owner, repo, baseBranch = 'main' } = params

      // Create a temporary directory to clone the repo
      const { mkdtemp } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { execa } = await import('execa')
      const { rm } = await import('node:fs/promises')

      const tempDir = await mkdtemp(join(tmpdir(), 'ensure-lerna-excluded-'))

      try {
        // Clone the repository
        await execa('git', [
          'clone',
          `https://github.com/${owner}/${repo}.git`,
          tempDir,
        ])

        // Check for update-dependencies.sh script
        const scriptPath = join(tempDir, 'scripts', 'update-dependencies.sh')

        try {
          await readFile(scriptPath, 'utf8')
        } catch (error) {
          return {
            success: true,
            message: 'No update-dependencies.sh script found',
          }
        }

        // Update the script
        const hasChanges = await ensureLernaExcludedInFile(scriptPath)

        if (!hasChanges) {
          return {
            success: true,
            message:
              'Lerna is already excluded in update-dependencies.sh script',
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
        const newBranch = `ensure-lerna-excluded-${Date.now()}`
        await execa('git', ['checkout', '-b', newBranch], { cwd: tempDir })
        await execa('git', ['add', '.'], { cwd: tempDir })
        await execa(
          'git',
          ['commit', '-m', 'ci: ensure lerna is excluded from ncu commands'],
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
          commitMessage: 'ci: ensure lerna is excluded from ncu commands',
          owner,
          pullRequestTitle: 'ci: ensure lerna is excluded from ncu commands',
          repo,
        })

        return {
          success: true,
          changedFiles,
          newBranch,
          message: 'Lerna exclusion added to update-dependencies.sh script',
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
