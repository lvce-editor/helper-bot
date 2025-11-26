import type { Migration, MigrationParams, MigrationResult } from './types.js'

const WORKFLOWS_DIR = '.github/workflows'

const enableAutoSquash = async (octokit: any, pullRequestData: any) => {
  await octokit.graphql(
    `mutation MyMutation {
  enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
    clientMutationId
  }
}
`,
  )
}

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
            status: 'success',
            changedFiles: 0,
            pullRequestTitle: 'feature: update permissions for open id connect publishing',
            message: 'release.yml is not a file',
          }
        }

        releaseWorkflow = result.data
      } catch (error: any) {
        if (error && error.status === 404) {
          return {
            status: 'success',
            changedFiles: 0,
            pullRequestTitle: 'feature: update permissions for open id connect publishing',
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

      const pullRequestTitle = 'feature: update permissions for open id connect publishing'

      // Check if content actually changed
      if (originalContent === updatedContent) {
        return {
          status: 'success',
          changedFiles: 0,
          pullRequestTitle,
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
        message: 'feature: update permissions for open id connect publishing',
        content: updatedContentBase64,
        branch: newBranch,
        sha: releaseWorkflow.sha,
      })

      // Create a pull request
      const pullRequestTitle = 'feature: update permissions for open id connect publishing'
      const pullRequestData = await octokit.rest.pulls.create({
        owner,
        repo,
        title: pullRequestTitle,
        head: newBranch,
        base: baseBranch,
      })

      // Enable auto squash merge
      await enableAutoSquash(octokit, pullRequestData)

      return {
        status: 'success',
        changedFiles: 1,
        pullRequestTitle,
        newBranch,
        message: 'OIDC permissions added to release.yml successfully',
      }
    } catch (error) {
      return {
        status: 'error',
        changedFiles: 0,
        pullRequestTitle: 'feature: update permissions for open id connect publishing',
        errorCode: 'ADD_OIDC_PERMISSIONS_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
