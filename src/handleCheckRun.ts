import { Context } from 'probot'
import { autoFixCi } from './autoFixCi'

export const handleCheckRun = async (context: Context<'check_run'>) => {
  const { check_run, repository } = context.payload
  const { owner, name } = repository

  // Only handle failed check runs
  if (check_run.conclusion !== 'failure') {
    return
  }

  // Get the PR number from the check run
  const { data: prs } = await context.octokit.rest.checks.listForRef({
    owner: owner.login,
    repo: name,
    ref: check_run.head_sha,
  })

  const pr = prs.check_runs[0]?.pull_requests?.[0]
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
  if (!committer) {
    return
  }

  const authorizedCommitter = process.env.AUTHORIZED_COMMITTER
  if (!authorizedCommitter) {
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
