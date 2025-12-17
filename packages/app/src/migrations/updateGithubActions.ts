import { updateGithubActions as updateGithubActionsCore } from '../updateGithubActions.ts'
import type { Migration, MigrationParams, MigrationResult } from './types.ts'

export const updateGithubActionsMigration: Migration = {
  name: 'updateGithubActions',
  description: 'Update GitHub Actions OS versions in workflow files',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { octokit, owner, repo, baseBranch = 'main' } = params

      const result = await updateGithubActionsCore({
        octokit,
        owner,
        repo,
        baseBranch,
        osVersions: {
          ubuntu: '24.04',
          windows: '2025',
          macos: '15',
        },
      })

      if (!result) {
        return {
          success: true,
          message: 'No workflows found',
        }
      }

      if (result.changedFiles === 0) {
        return {
          success: true,
          message: 'No workflow updates needed',
        }
      }

      return {
        success: true,
        changedFiles: result.changedFiles,
        newBranch: result.newBranch,
        message: 'GitHub Actions update PR created successfully',
      }
    } catch (error) {
      // Check if it's a 404 error (no workflows found)
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not found'))) {
        return {
          success: true,
          message: 'No workflows found',
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
