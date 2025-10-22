import type { Migration, MigrationParams, MigrationResult } from './types.js'

const WORKFLOWS_DIR = '.github/workflows'

const addOidcPermissionsToWorkflow = (content: string): string => {
  // Check if permissions section already exists
  if (content.includes('permissions:')) {
    return content
  }

  // Find the jobs section and add permissions before it
  const lines = content.split('\n')
  const jobsIndex = lines.findIndex((line) => line.trim().startsWith('jobs:'))

  if (jobsIndex === -1) {
    // If no jobs section found, add permissions at the end of the file
    lines.push('')
    lines.push('permissions:')
    lines.push('  id-token: write # Required for OIDC')
    lines.push('  contents: write')
    return lines.join('\n')
  }

  // Insert permissions before the jobs section
  const newLines = [
    ...lines.slice(0, jobsIndex),
    '',
    'permissions:',
    '  id-token: write # Required for OIDC',
    '  contents: write',
    '',
    ...lines.slice(jobsIndex),
  ]

  return newLines.join('\n')
}

export const addOidcPermissionsMigration: Migration = {
  name: 'addOidcPermissions',
  description:
    'Add OpenID Connect permissions to release.yml workflow files for secure npm publishing',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { octokit, owner, repo, baseBranch = 'main' } = params

      // Check if release.yml exists
      let releaseWorkflow
      try {
        const result = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: `${WORKFLOWS_DIR}/release.yml`,
          ref: baseBranch,
        })

        if (!('content' in result.data)) {
          return {
            success: true,
            message: 'release.yml is not a file',
          }
        }

        releaseWorkflow = result.data
      } catch (error: any) {
        if (error && error.status === 404) {
          return {
            success: true,
            message: 'release.yml not found',
          }
        }
        throw error
      }

      // Decode the content
      const originalContent = Buffer.from(
        releaseWorkflow.content,
        'base64',
      ).toString()

      // Add OIDC permissions
      const updatedContent = addOidcPermissionsToWorkflow(originalContent)

      // Check if content actually changed
      if (originalContent === updatedContent) {
        return {
          success: true,
          message: 'OIDC permissions already present in release.yml',
        }
      }

      // Create a new branch
      const newBranch = `add-oidc-permissions-${Date.now()}`

      // Get the main branch reference
      const mainBranchRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      })

      // Create the new branch
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranch}`,
        sha: mainBranchRef.data.object.sha,
      })

      // Update the file
      const updatedContentBase64 =
        Buffer.from(updatedContent).toString('base64')

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `${WORKFLOWS_DIR}/release.yml`,
        message: 'Add OIDC permissions for secure npm publishing',
        content: updatedContentBase64,
        branch: newBranch,
        sha: releaseWorkflow.sha,
      })

      // Create a pull request
      await octokit.rest.pulls.create({
        owner,
        repo,
        title: 'feature: update permissions for open id connect publishing',
        head: newBranch,
        base: baseBranch,
        body: `This PR adds the required OpenID Connect permissions to the release.yml workflow file for more secure npm publishing.

The added permissions are:
- \`id-token: write\` - Required for OIDC token generation
- \`contents: write\` - Required for publishing to npm

This follows GitHub's recommended security practices for npm publishing workflows.`,
      })

      return {
        success: true,
        changedFiles: 1,
        newBranch,
        message: 'OIDC permissions added to release.yml successfully',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
