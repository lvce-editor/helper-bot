import { execa } from 'execa'
import { tmpdir } from 'os'
import { join } from 'path'
import { ProbotOctokit } from 'probot'
import { cloneRepo } from './cloneRepo.js'
import { commitAndPush } from './commitAndPush.js'
import { rm } from 'node:fs/promises'
import { captureException } from './errorHandling.js'
import { createQueue } from './createQueue.js'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'

type QueueItem = {
  octokit: ProbotOctokit
  owner: string
  repo: string
  prNumber: number
}

const installDependencies = async (cwd: string): Promise<void> => {
  // Run npm ci with postinstall scripts disabled
  await execa('nice', ['-n', '19', 'npm', 'ci', '--ignore-scripts'], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  })

  // Check if packages directory exists and install dependencies for each package
  const packagesDir = join(cwd, 'packages')
  if (existsSync(packagesDir)) {
    const packages = await readdir(packagesDir, { withFileTypes: true })
    for (const pkg of packages) {
      if (pkg.isDirectory()) {
        const pkgPath = join(packagesDir, pkg.name)
        const pkgJsonPath = join(pkgPath, 'package.json')
        if (existsSync(pkgJsonPath)) {
          await execa('nice', ['npm', 'ci'], {
            cwd: pkgPath,
            env: {
              ...process.env,
              NODE_ENV: 'development',
            },
          })
        }
      }
    }
  }
}

const handleQueueItem = async (item: QueueItem): Promise<void> => {
  const { octokit, owner, repo, prNumber } = item

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
    await installDependencies(tempDir)
    await execa('npx', ['eslint', '.', '--fix'], {
      cwd: tempDir,
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    })
    await commitAndPush(tempDir, branchName, octokit, owner, repo, {
      commitMessage: 'style: fix eslint errors',
      createNewBranch: false,
      baseBranch: branchName,
    })
  } catch (error) {
    captureException(error as Error)
    // If eslint fails or can't fix, do nothing
    return
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const { addToQueue } = createQueue<QueueItem>(handleQueueItem)

export const autoFixCi = async (octokit: ProbotOctokit, owner: string, repo: string, prNumber: number): Promise<void> => {
  await addToQueue({
    octokit,
    owner,
    repo,
    prNumber,
  })
}
