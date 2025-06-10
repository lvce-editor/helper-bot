import { execa } from 'execa'
import { tmpdir } from 'os'
import { join } from 'path'
import { Context } from 'probot'
import { cloneRepo } from './cloneRepo'
import { commitAndPush } from './commitAndPush'

export const autoFixCi = async (
  context: Context,
  owner: string,
  repo: string,
  prNumber: number,
  committer: string,
  authorizedCommitter: string,
): Promise<void> => {
  if (committer !== authorizedCommitter) {
    return
  }
  const octokit = context.octokit

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  })

  const branchName = pr.head.ref
  const cloneUrl = pr.head.repo?.clone_url

  if (!cloneUrl) {
    throw new Error('Could not get clone URL')
  }

  const tempDir = join(tmpdir(), `helper-bot-${Date.now()}`)
  await cloneRepo(owner, repo, tempDir)

  try {
    await execa('git', ['checkout', branchName], { cwd: tempDir })
    await execa('npm', ['ci'], { cwd: tempDir })
    await execa('npx', ['eslint', '.', '--fix'], { cwd: tempDir })
  } catch (error) {
    // If eslint fails or can't fix, do nothing
    return
  }

  await commitAndPush(tempDir, branchName, octokit, owner, repo)
}
