import { execa } from 'execa'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { Context, Probot } from 'probot'
import { commitAndPush } from './commitAndPush.js'
import { createQueue } from './createQueue.js'
import { updateNodeVersion } from './updateNodeVersion.js'
import { captureException } from './errorHandling.js'
import { ensureLernaExcluded } from './ensureLernaExcluded.js'

const TEMP_CLONE_PREFIX = 'update-dependencies-'

type QueueItem = {
  repositoryName: string
  req: Request
  res: Response
  octokit: Context<'release'>['octokit']
}

const verifySecret = (req: Request, res: Response, secret: string) => {
  const providedSecret = req.query.secret
  if (providedSecret !== secret) {
    res.status(401).send('Unauthorized')
    return false
  }
  return true
}

const cloneRepo = async (owner: string, repo: string, tmpFolder: string) => {
  await mkdir(tmpFolder, { recursive: true })
  await execa('git', ['clone', `https://github.com/${owner}/${repo}.git`, tmpFolder])
}

const createPullRequest = async (octokit: Context<'release'>['octokit'], owner: string, repo: string, branchName: string) => {
  const pullRequestData = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branchName,
    base: 'main',
    title: 'update dependencies',
  })

  await octokit.graphql(
    `mutation MyMutation {
      enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
        clientMutationId
      }
    }`,
  )
}

const updateDependencies = async (tmpFolder: string, maxAttempts: number = 3, retryDelay: number = 60000) => {
  const scriptPath = join(tmpFolder, 'scripts', 'update-dependencies.sh')

  // Check if the script exists and ensure lerna is excluded
  if (existsSync(scriptPath)) {
    await ensureLernaExcluded(scriptPath)
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await execa('bash', [scriptPath], {
        cwd: tmpFolder,
      })
      return // Success, exit the retry loop
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Always reset the folder to a clean state before retrying
      try {
        await execa('git', ['reset', '--hard'], { cwd: tmpFolder })
      } catch (resetError) {
        console.warn('Failed to reset folder with git reset --hard:', resetError)
      }
      // Check if this is an ETARGET error
      if (errorMessage.includes('ETARGET') || errorMessage.includes('No matching version found')) {
        if (attempt < maxAttempts) {
          console.log(`Attempt ${attempt} failed with ETARGET error, retrying in ${retryDelay / 1000} seconds...`)
          await setTimeout(retryDelay) // Wait retryDelay ms
          continue
        } else {
          console.log(`All ${maxAttempts} attempts failed with ETARGET error`)
          throw error
        }
      } else {
        // Not an ETARGET error, don't retry
        throw error
      }
    }
  }
}

const findExistingUpdateDependenciesPR = async (
  octokit: Context<'release'>['octokit'],
  owner: string,
  repo: string,
): Promise<{ pr: any; branchName: string } | null> => {
  const BOT_ID = process.env.BOT_USER_ID ? Number(process.env.BOT_USER_ID) : undefined
  if (!BOT_ID) {
    console.warn('BOT_USER_ID environment variable is not set. PR author check will be less secure.')
  }
  try {
    const { data: pullRequests } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'open',
      head: `${owner}:update-dependencies-`,
    })

    // Find PRs with "update dependencies" title from the bot user
    const updateDepsPR = pullRequests.find((pr) => pr.title === 'update dependencies' && (BOT_ID ? pr.user?.id === BOT_ID : true) && pr.user?.type === 'Bot')

    if (updateDepsPR) {
      return {
        pr: updateDepsPR,
        branchName: updateDepsPR.head.ref,
      }
    }

    return null
  } catch (error) {
    console.warn('Failed to find existing PR:', error)
    return null
  }
}

const handleQueueItem = async (item: QueueItem) => {
  try {
    const [owner, repo] = item.repositoryName.split('/')

    if (owner !== 'lvce-editor') {
      item.res.status(400).send('Repository owner must be lvce-editor')
      return
    }

    // Check if repository exists
    try {
      await item.octokit.rest.repos.get({
        owner,
        repo,
      })
    } catch (error) {
      // @ts-ignore
      if (error.status === 404) {
        item.res.status(404).send('Repository not found')
        return
      }
      throw error
    }

    // Check for existing update-dependencies PR
    const existingPR = await findExistingUpdateDependenciesPR(item.octokit, owner, repo)

    const uuid = randomUUID()
    const tmpFolder = join(tmpdir(), `${TEMP_CLONE_PREFIX}${repo}-${uuid}`)
    const branchName = existingPR ? existingPR.branchName : `update-dependencies-${Date.now()}`

    try {
      await cloneRepo(owner, repo, tmpFolder)
      await updateNodeVersion({ root: tmpFolder })
      await updateDependencies(tmpFolder)
      const hasChanges = await commitAndPush(tmpFolder, branchName, item.octokit, owner, repo, {
        createNewBranch: !existingPR,
        baseBranch: existingPR ? branchName : 'main',
      })
      if (!hasChanges) {
        item.res.status(200).send('No changes to commit')
        return
      }

      if (existingPR) {
        item.res.status(200).send('Dependencies update PR updated successfully')
      } else {
        await createPullRequest(item.octokit, owner, repo, branchName)
        item.res.status(200).send('Dependencies update PR created successfully')
      }
    } finally {
      await rm(tmpFolder, { recursive: true, force: true })
    }
  } catch (error) {
    captureException(error as Error)
    item.res.status(424).json({
      error: 'Failed to update dependencies',
      // @ts-ignore
      details: error.message,
      code: 'DEPENDENCY_UPDATE_FAILED',
    })
  }
}

const { addToQueue } = createQueue<QueueItem>(handleQueueItem)

/**
 * Handle the dependencies update
 * @param {{ app: import('probot').Probot, secret: string, installationId:number }} params
 */
export const handleDependencies =
  ({ app, secret, installationId }: { app: Probot; secret: string; installationId: number }) =>
  async (req: Request, res: Response) => {
    if (!verifySecret(req, res, secret)) {
      return
    }

    const octokit = await app.auth(installationId)

    const repositoryName = req.query.repositoryName
    if (!repositoryName) {
      res.status(400).send('Missing repositoryName parameter')
      return
    }

    if (typeof repositoryName !== 'string') {
      res.status(400).send('Invalid repositoryName parameter')
      return
    }

    await addToQueue({
      repositoryName,
      req,
      res,
      octokit,
    })
  }

export { updateDependencies }
