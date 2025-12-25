import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'

export interface FileToCommit {
  readonly content: string
  readonly mode?: '100644'
  readonly path: string
  readonly type?: 'blob'
}

export interface CommitFilesOptions {
  readonly branchName: string
  readonly commitMessage: string
  readonly files: FileToCommit[]
  readonly githubToken: string
  readonly owner: string
  readonly repo: string
}

export interface CommitFilesResult {
  readonly commitSha: string
}

export const commitFiles = async (options: CommitFilesOptions): Promise<CommitFilesResult | undefined> => {
  const { branchName, commitMessage, files, githubToken, owner, repo } = options

  if (files.length === 0) {
    return undefined
  }

  const octokit: Octokit = new OctokitConstructor({
    auth: githubToken,
  })

  // Get branch reference and latest commit
  const branchRef = await octokit.rest.git.getRef({
    owner,
    ref: `heads/${branchName}`,
    repo,
  })

  const latestCommit = await octokit.rest.git.getCommit({
    commit_sha: branchRef.data.object.sha,
    owner,
    repo,
  })

  const treeEntries = files.map((file) => ({
    content: file.content,
    mode: (file.mode || '100644') as '100644',
    path: file.path,
    type: (file.type || 'blob') as 'blob',
  }))

  const newTree = await octokit.rest.git.createTree({
    base_tree: latestCommit.data.tree.sha,
    owner,
    repo,
    tree: treeEntries,
  })

  const commit = await octokit.rest.git.createCommit({
    message: commitMessage,
    owner,
    parents: [latestCommit.data.sha],
    repo,
    tree: newTree.data.sha,
  })

  await octokit.rest.git.updateRef({
    owner,
    ref: `heads/${branchName}`,
    repo,
    sha: commit.data.sha,
  })

  return {
    commitSha: commit.data.sha,
  }
}
