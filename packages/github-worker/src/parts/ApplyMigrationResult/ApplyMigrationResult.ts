import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import { applyRepoCommands, type RepoCommand } from '../ApplyRepoCommands/ApplyRepoCommands.ts'

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
  readonly repoCommands?: readonly RepoCommand[]
}

export interface ApplyMigrationResultResult {
  readonly branchName: string
  readonly changedFiles: number
  readonly data?: any
  readonly message: string
  readonly pullRequestNumber?: number
  readonly status: 'success'
}

interface TreeEntry {
  readonly content: string
  readonly mode: '100644'
  readonly path: string
  readonly type: 'blob'
}

interface DeletionEntry {
  readonly mode: '100644'
  readonly path: string
  readonly sha: string | null
  readonly type: 'blob'
}

interface PullRequestData {
  readonly node_id: string
  readonly number: number
}

const isNotFoundError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}

const isReferenceAlreadyExistsError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 422
}

const findOpenPullRequest = async (octokit: Readonly<Octokit>, owner: string, repo: string, branchName: string): Promise<PullRequestData | undefined> => {
  const pullRequests = await octokit.rest.pulls.list({
    head: `${owner}:${branchName}`,
    owner,
    repo,
    state: 'open',
  })
  return pullRequests.data[0]
}

const createPullRequest = async (
  octokit: Readonly<Octokit>,
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string,
  pullRequestTitle: string,
): Promise<{ readonly data: PullRequestData }> => {
  try {
    return await octokit.rest.pulls.create({
      base: baseBranch,
      head: branchName,
      owner,
      repo,
      title: pullRequestTitle,
    })
  } catch (error) {
    if (!isReferenceAlreadyExistsError(error)) {
      throw error
    }
    const existingPullRequest = await findOpenPullRequest(octokit, owner, repo, branchName)
    if (!existingPullRequest) {
      throw error
    }
    return {
      data: existingPullRequest,
    }
  }
}

const getExistingContent = async (octokit: Readonly<Octokit>, owner: string, repo: string, baseBranch: string, path: string): Promise<string | null> => {
  try {
    const fileContent = await octokit.rest.repos.getContent({
      owner,
      path,
      ref: baseBranch,
      repo,
    })
    if ('content' in fileContent.data && typeof fileContent.data.content === 'string') {
      return Buffer.from(fileContent.data.content, 'base64').toString('utf8')
    }
    return null
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
}

const shouldDeleteFile = async (octokit: Readonly<Octokit>, owner: string, repo: string, baseBranch: string, path: string): Promise<boolean> => {
  try {
    await octokit.rest.repos.getContent({
      owner,
      path,
      ref: baseBranch,
      repo,
    })
    return true
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }
    throw error
  }
}

const collectTreeChanges = async (
  octokit: Readonly<Octokit>,
  owner: string,
  repo: string,
  baseBranch: string,
  changedFiles: readonly ChangedFile[],
): Promise<{ filesToDelete: string[]; treeEntries: TreeEntry[] }> => {
  const treeEntries: TreeEntry[] = []
  const filesToDelete: string[] = []

  for (const changedFile of changedFiles) {
    if (changedFile.type === 'deleted') {
      if (await shouldDeleteFile(octokit, owner, repo, baseBranch, changedFile.path)) {
        filesToDelete.push(changedFile.path)
      }
      continue
    }

    const existingContent = await getExistingContent(octokit, owner, repo, baseBranch, changedFile.path)
    if (existingContent !== null && existingContent === changedFile.content) {
      continue
    }
    treeEntries.push({
      content: changedFile.content,
      mode: '100644',
      path: changedFile.path,
      type: 'blob',
    })
  }

  return { filesToDelete, treeEntries }
}

const toDeletionEntries = (filesToDelete: readonly string[]): DeletionEntry[] => {
  return filesToDelete.map((path) => ({
    mode: '100644',
    path,
    sha: null,
    type: 'blob',
  }))
}

const enableAutoSquash = async (octokit: Readonly<Octokit>, pullRequestData: Readonly<{ data: { node_id: string } }>): Promise<void> => {
  await octokit.graphql(
    `mutation MyMutation {
      enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
        clientMutationId
      }
    }`,
  )
}

export const applyMigrationResult = async (options: Readonly<ApplyMigrationResultOptions>): Promise<ApplyMigrationResultResult | undefined> => {
  const {
    baseBranch = 'main',
    branchName: providedBranchName,
    changedFiles,
    commitMessage: providedCommitMessage,
    githubToken,
    owner,
    pullRequestTitle,
    repo,
    repoCommands = [],
  } = options

  if (changedFiles.length === 0 && repoCommands.length === 0) {
    return undefined
  }

  const octokit: Octokit = new OctokitConstructor({
    auth: githubToken,
  })

  const appliedRepoCommands = await applyRepoCommands(octokit, owner, repo, repoCommands)

  if (changedFiles.length === 0) {
    return {
      branchName: '',
      changedFiles: 0,
      ...(appliedRepoCommands === 0 ? {} : { data: { appliedRepoCommands } }),
      message: 'Migration completed successfully',
      status: 'success',
    }
  }

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
  const { filesToDelete, treeEntries } = await collectTreeChanges(octokit, owner, repo, baseBranch, changedFiles)

  // If there are no actual changes (all files unchanged), return undefined
  if (treeEntries.length === 0 && filesToDelete.length === 0) {
    return undefined
  }

  try {
    await octokit.rest.git.createRef({
      owner,
      ref: `refs/heads/${branchName}`,
      repo,
      sha: startingCommitSha,
    })
  } catch (error) {
    if (!isReferenceAlreadyExistsError(error)) {
      throw error
    }
  }

  // Create tree with all changes
  // When using base_tree, files not specified remain unchanged
  // To delete files, include them in the tree with sha: null
  const deletionEntries = toDeletionEntries(filesToDelete)

  // Combine: deletion entries + new/updated files
  const allTreeEntries = [...deletionEntries, ...treeEntries]

  const newTree = await octokit.rest.git.createTree({
    base_tree: latestCommit.data.tree.sha,
    owner,
    repo,
    tree: allTreeEntries,
  })
  const newTreeSha = newTree.data.sha

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
  const pullRequestData = await createPullRequest(octokit, owner, repo, branchName, baseBranch, pullRequestTitle)

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
