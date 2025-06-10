import { Context } from 'probot'
import { autoFixCi } from './autoFixCi.js'

export const handleCheckRun = async (
  context: Context<'check_run'>,
  authorizedCommitter: string,
) => {
  const { check_run, repository } = context.payload
  const { owner, name } = repository

  // Only handle failed check runs
  if (check_run.conclusion !== 'failure') {
    return
  }

  const pr = check_run.pull_requests?.[0]
  if (!pr) {
    return
  }

  // Get the committer from the check run
  const { data: commit } = await context.octokit.rest.repos.getCommit({
    owner: owner.login,
    repo: name,
    ref: check_run.head_sha,
  })

  const committer = commit.commit.author?.email
  if (!committer || committer !== authorizedCommitter) {
    return
  }

  // Get PR details to check if it's from a fork
  const { data: prData } = await context.octokit.rest.pulls.get({
    owner: owner.login,
    repo: name,
    pull_number: pr.number,
  })

  // Check if the PR is from a fork
  if (prData.head.repo.full_name !== `${owner.login}/${name}`) {
    return
  }

  await autoFixCi(
    context.octokit,
    owner.login,
    name,
    pr.number,
    committer,
    authorizedCommitter,
  )
}
