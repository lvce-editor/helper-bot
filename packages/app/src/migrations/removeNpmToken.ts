import type { Migration, MigrationParams, MigrationResult } from './types.ts'

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

const removeNpmTokenFromWorkflow = (content: string): string => {
  // Pattern to match the env section with NODE_AUTH_TOKEN
  // This matches the exact pattern: env: followed by NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
  const npmTokenPattern = /^\s*env:\s*\n\s*NODE_AUTH_TOKEN:\s*\${{secrets\.NPM_TOKEN}}\s*$/gm

  const updatedContent = content.replace(npmTokenPattern, '')

  return updatedContent
}

export const removeNpmTokenMigration: Migration = {
  name: 'removeNpmToken',
  description: 'Remove NODE_AUTH_TOKEN from release.yml workflow files since npm now supports OpenID Connect publishing',
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
      const originalContent = Buffer.from(releaseWorkflow.content, 'base64').toString()

      // Remove npm token
      const updatedContent = removeNpmTokenFromWorkflow(originalContent)

      // Check if content actually changed
      if (originalContent === updatedContent) {
        return {
          success: true,
          message: 'No NODE_AUTH_TOKEN found in release.yml',
        }
      }

      // Create a new branch
      const newBranch = `remove-npm-token-${Date.now()}`

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
      const updatedContentBase64 = Buffer.from(updatedContent).toString('base64')

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `${WORKFLOWS_DIR}/release.yml`,
        message: 'ci: remove NODE_AUTH_TOKEN from release workflow',
        content: updatedContentBase64,
        branch: newBranch,
        sha: releaseWorkflow.sha,
      })

      // Create a pull request
      const pullRequestData = await octokit.rest.pulls.create({
        owner,
        repo,
        title: 'ci: remove NODE_AUTH_TOKEN from release workflow',
        head: newBranch,
        base: baseBranch,
      })

      // Enable auto squash merge
      await enableAutoSquash(octokit, pullRequestData)

      return {
        success: true,
        changedFiles: 1,
        newBranch,
        message: 'NODE_AUTH_TOKEN removed from release.yml successfully',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
