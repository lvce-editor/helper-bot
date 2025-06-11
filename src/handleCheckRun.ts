import { Context } from 'probot'
import { autoFixCi } from './autoFixCi.js'

export const handleCheckRun = async (
  context: Context<'check_suite'>,
  authorizedCommitter: string,
) => {
  const { check_suite, repository, sender } = context.payload
  const { owner, name } = repository

  console.log(`Received check suite from repository: ${owner.login}/${name}`)

  // Only handle failed check suites
  if (check_suite.conclusion !== 'failure') {
    console.log('no failure')
    return
  }

  const pr = check_suite.pull_requests?.[0]
  if (!pr) {
    console.log('no pr')
    return
  }

  if (!sender.login || sender.login !== authorizedCommitter) {
    console.log('not authorized')
    return
  }

  // Get PR details to check if it's from a fork
  const { data: prData } = await context.octokit.rest.pulls.get({
    owner: owner.login,
    repo: name,
    pull_number: pr.number,
  })

  // Check if the PR is from a fork
  if (prData.head.repo.owner.login !== owner.login) {
    console.log('pr is from fork')

    return
  }

  console.log('begin autofix ci')
  await autoFixCi(context.octokit, owner.login, name, pr.number)
}
