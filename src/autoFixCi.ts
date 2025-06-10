import { execa } from 'execa'
import { tmpdir } from 'os'
import { join } from 'path'
import { ProbotOctokit } from 'probot'
import { cloneRepo } from './cloneRepo.js'
import { commitAndPush } from './commitAndPush.js'
import { rm } from 'node:fs/promises'
import { captureException } from './errorHandling.js'

export const autoFixCi = async (
  octokit: ProbotOctokit,
  owner: string,
  repo: string,
  prNumber: number,
  committer: string,
  authorizedCommitter: string,
): Promise<void> => {
  if (committer !== authorizedCommitter) {
    return
  }

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
    await commitAndPush(tempDir, branchName, octokit, owner, repo)
  } catch (error) {
    captureException(error as Error)
    // If eslint fails or can't fix, do nothing
    return
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
