import { Context } from 'probot'

export const createPullRequest = async ({
  baseBranch,
  newBranch,
  octokit,
  owner,
  repo,
  commitableFiles,
  commitMessage,
  pullRequestTitle,
}: {
  baseBranch: string
  newBranch: string
  octokit: Context<'release'>['octokit']
  owner: string
  repo: string
  commitableFiles: readonly any[]
  commitMessage: string
  pullRequestTitle: string
}) => {
  const mainBranchRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  })

  console.log({ mainBranchRef })

  const latestCommit = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: mainBranchRef.data.object.sha,
  })

  console.log({ latestCommit })

  const startingCommitSha = latestCommit.data.sha

  console.log('created branch')

  const newTree = await octokit.rest.git.createTree({
    owner,
    repo,
    // @ts-ignore
    tree: commitableFiles,
    base_tree: startingCommitSha,
  })

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.data.sha,
    parents: [startingCommitSha],
  })

  const newBranchRef = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: commit.data.sha,
  })

  console.log({ newBranchRef })
  const pullRequestData = await octokit.rest.pulls.create({
    owner,
    repo,
    head: newBranch,
    base: baseBranch,
    title: pullRequestTitle,
  })
  return pullRequestData
}
