import { createPullRequest } from '../createPullRequest.js'
import type { MigrationParams } from './types.js'

export interface ChangedFile {
  path: string
  content: string
}

const modeFile: '100644' = '100644'
const typeFile: 'blob' = 'blob'

const enableAutoSquash = async (
  octokit: MigrationParams['octokit'],
  pullRequestData: any,
): Promise<void> => {
  await octokit.graphql(
    `mutation MyMutation {
  enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
    clientMutationId
  }
}
`,
    {},
  )
}

export const applyMigrationResult = async (
  params: MigrationParams,
  changedFiles: readonly ChangedFile[],
  pullRequestTitle: string,
  commitMessage: string,
  newBranch: string,
): Promise<{
  success: boolean
  changedFiles: number
  newBranch: string
  message?: string
  error?: string
}> => {
  try {
    const { octokit, owner, repo, baseBranch = 'main' } = params

    if (changedFiles.length === 0) {
      return {
        success: true,
        changedFiles: 0,
        newBranch,
        message: 'No changes needed',
      }
    }

    const commitableFiles = changedFiles.map((file) => ({
      path: file.path,
      mode: modeFile,
      type: typeFile,
      content: file.content,
    }))

    const pullRequestData = await createPullRequest({
      octokit,
      baseBranch,
      newBranch,
      commitableFiles,
      commitMessage,
      owner,
      pullRequestTitle,
      repo,
    })

    await enableAutoSquash(octokit, pullRequestData)

    return {
      success: true,
      changedFiles: changedFiles.length,
      newBranch,
      message: `Migration applied successfully`,
    }
  } catch (error) {
    return {
      success: false,
      changedFiles: 0,
      newBranch,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
