import type { Octokit } from '@octokit/rest'
import { VError } from '@lvce-editor/verror'
import { Octokit as OctokitConstructor } from '@octokit/rest'

export interface ChangedFile {
  readonly content: string
  readonly path: string
  readonly type?: 'created' | 'updated' | 'deleted'
}

export interface MigrationResult {
  readonly branchName?: string
  readonly changedFiles: ChangedFile[]
  readonly commitMessage?: string
  readonly data?: any
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly pullRequestTitle: string
  readonly status: 'success' | 'error'
  readonly statusCode: number
}

export interface ApplyMigrationResultOptions {
  readonly baseBranch?: string
  readonly branchName?: string
  readonly changedFiles: ChangedFile[]
  readonly commitMessage?: string
  readonly githubToken: string
  readonly owner: string
  readonly pullRequestTitle: string
  readonly repo: string
}

export interface ApplyMigrationResultResult {
  readonly branchName: string
  readonly changedFiles: number
  readonly data?: any
  readonly message: string
  readonly pullRequestNumber?: number
  readonly status: 'success'
}

const enableAutoSquash = async (octokit: Octokit, pullRequestData: { data: { node_id: string } }): Promise<void> => {
  await octokit.graphql(
    `mutation MyMutation {
      enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
        clientMutationId
      }
    }`,
  )
}

export const applyMigrationResult = async (options: ApplyMigrationResultOptions): Promise<ApplyMigrationResultResult | undefined> => {
  const {
    baseBranch = 'main',
    branchName: providedBranchName,
    changedFiles,
    commitMessage: providedCommitMessage,
    githubToken,
    owner,
    pullRequestTitle,
    repo,
  } = options

  if (changedFiles.length === 0) {
    return undefined
  }

  const octokit: Octokit = new OctokitConstructor({
    auth: githubToken,
  })

  const branchName = providedBranchName || `migration-${Date.now()}`
  const commitMessage = providedCommitMessage || pullRequestTitle

  // Get base branch reference and latest commit
  const baseRef = await octokit.rest.git.getRef({
    owner,
    ref: `heads/${baseBranch}`,
    repo,
  })

  const latestCommit = await octokit.rest.git.getCommit({
    commit_sha: baseRef.data.object.sha,
    owner,
    repo,
  })

  const startingCommitSha = latestCommit.data.sha

  // Collect files that actually changed and build tree entries
  const treeEntries: Array<{
    path: string
    mode: '100644'
    type: 'blob'
    content: string
  }> = []
  const filesToDelete: string[] = []

  for (const changedFile of changedFiles) {
    // Handle deleted files
    if (changedFile.type === 'deleted') {
      // Check if file exists
      try {
        await octokit.rest.repos.getContent({
          owner,
          path: changedFile.path,
          ref: baseBranch,
          repo,
        })
        filesToDelete.push(changedFile.path)
      } catch (error) {
        // File doesn't exist, nothing to delete
        // @ts-ignore
        if (error && error.status !== 404) {
          throw error
        }
      }
      continue
    }

    // For created/updated files, check if content actually changed
    let existingContent: string | null = null
    try {
      const fileContent = await octokit.rest.repos.getContent({
        owner,
        path: changedFile.path,
        ref: baseBranch,
        repo,
      })
      if ('content' in fileContent.data && typeof fileContent.data.content === 'string') {
        existingContent = Buffer.from(fileContent.data.content, 'base64').toString('utf8')
      }
    } catch (error) {
      // File doesn't exist, that's okay - we'll create it
      // @ts-ignore
      if (error && error.status !== 404) {
        throw error
      }
    }

    // Only add to tree if content actually changed
    if (existingContent === null || existingContent !== changedFile.content) {
      treeEntries.push({
        content: changedFile.content,
        mode: '100644',
        path: changedFile.path,
        type: 'blob',
      })
    }
  }

  // If there are no actual changes (all files unchanged), return undefined
  if (treeEntries.length === 0 && filesToDelete.length === 0) {
    return undefined
  }

  // Create new branch pointing to base commit
  await octokit.rest.git.createRef({
    owner,
    ref: `refs/heads/${branchName}`,
    repo,
    sha: startingCommitSha,
  })

  // Create tree with all changes
  // When using base_tree, files not specified remain unchanged
  // To delete files, we need to get the full tree and exclude deleted files
  let newTreeSha: string
  if (filesToDelete.length > 0) {
    // Get the current tree recursively to handle deletions
    const currentTree = await octokit.rest.git.getTree({
      owner,
      // @ts-ignore - recursive parameter type issue in octokit types
      recursive: 1,
      repo,
      tree_sha: latestCommit.data.tree.sha,
    })

    // Build a map of paths to update (from treeEntries)
    const pathsToUpdate = new Set(treeEntries.map((entry) => entry.path))
    const pathsToDelete = new Set(filesToDelete)

    // Filter tree: exclude deleted files, and replace updated files
    const existingTreeEntries = currentTree.data.tree
      .filter((entry) => entry.type === 'blob' && !pathsToDelete.has(entry.path) && !pathsToUpdate.has(entry.path))
      .map((entry) => ({
        mode: entry.mode as '100644',
        path: entry.path,
        sha: entry.sha,
        type: entry.type as 'blob',
      }))

    // Combine: existing files (minus deletions and updates) + new/updated files
    const allTreeEntries = [...existingTreeEntries, ...treeEntries]

    const newTree = await octokit.rest.git.createTree({
      base_tree: latestCommit.data.tree.sha,
      owner,
      repo,
      tree: allTreeEntries,
    })
    newTreeSha = newTree.data.sha
  } else {
    // No deletions, just create tree with new/updated files using base_tree
    const newTree = await octokit.rest.git.createTree({
      base_tree: latestCommit.data.tree.sha,
      owner,
      repo,
      tree: treeEntries,
    })
    newTreeSha = newTree.data.sha
  }

  // Create a single commit with all changes
  const commit = await octokit.rest.git.createCommit({
    message: commitMessage,
    owner,
    parents: [startingCommitSha],
    repo,
    tree: newTreeSha,
  })

  // Update branch to point to new commit
  await octokit.rest.git.updateRef({
    owner,
    ref: `heads/${branchName}`,
    repo,
    sha: commit.data.sha,
  })

  // Create pull request
  const pullRequestData = await octokit.rest.pulls.create({
    base: baseBranch,
    head: branchName,
    owner,
    repo,
    title: pullRequestTitle,
  })

  // Enable auto merge squash
  await enableAutoSquash(octokit, pullRequestData)

  return {
    branchName,
    changedFiles: treeEntries.length + filesToDelete.length,
    message: 'Migration completed successfully',
    pullRequestNumber: pullRequestData.data.number,
    status: 'success',
  }
}
