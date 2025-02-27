import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'

const TEMP_CLONE_PREFIX = 'update-dependencies-'

/**
 * Verify the secret key
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} secret
 * @returns {boolean}
 */
const verifySecret = (req, res, secret) => {
  const providedSecret = req.query.secret
  if (providedSecret !== secret) {
    res.status(401).send('Unauthorized')
    return false
  }
  return true
}

/**
 * Clone the repository
 * @param {string} owner
 * @param {string} repo
 * @param {string} tmpFolder
 */
const cloneRepo = async (owner, repo, tmpFolder) => {
  await mkdir(tmpFolder, { recursive: true })
  await execa('git', [
    'clone',
    `https://github.com/${owner}/${repo}.git`,
    tmpFolder,
  ])
}

/**
 * Create a pull request
 * @param {import('probot').Context<"release">['octokit']} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} branchName
 */
const createPullRequest = async (octokit, owner, repo, branchName) => {
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

/**
 * Update the dependencies
 * @param {string} tmpFolder
 */
const updateDependencies = async (tmpFolder) => {
  const scriptPath = join(tmpFolder, 'scripts', 'update-dependencies.sh')
  await execa('bash', [scriptPath], {
    cwd: tmpFolder,
  })
}

/**
 * Commit and push the changes
 * @param {string} tmpFolder
 * @param {string} branchName
 */
const commitAndPush = async (tmpFolder, branchName) => {
  await execa('git', ['checkout', '-b', branchName], { cwd: tmpFolder })
  await execa('git', ['add', '.'], { cwd: tmpFolder })
  await execa('git', ['commit', '-m', 'update dependencies'], {
    cwd: tmpFolder,
  })
  await execa('git', ['push', 'origin', branchName], { cwd: tmpFolder })
}

/**
 * Handle the dependencies update
 * @param {{ octokit: import('probot').Context<"release">['octokit'], secret: string }} params
 */
export const handleDependencies =
  ({ octokit, secret }) =>
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async (req, res) => {
    if (!verifySecret(req, res, secret)) {
      return
    }

    const repositoryName = req.query.repositoryName
    if (!repositoryName) {
      res.status(400).send('Missing repositoryName parameter')
      return
    }

    if (typeof repositoryName !== 'string') {
      res.status(400).send('Invalid repositoryName parameter')
      return
    }

    try {
      const [owner, repo] = repositoryName.split('/')

      if (owner !== 'lvce-editor') {
        res.status(400).send('Repository owner must be lvce-editor')
        return
      }

      // Check if repository exists
      try {
        await octokit.rest.repos.get({
          owner,
          repo,
        })
      } catch (error) {
        // @ts-ignore
        if (error.status === 404) {
          res.status(404).send('Repository not found')
          return
        }
        throw error
      }

      const tmpFolder = join(tmpdir(), `${TEMP_CLONE_PREFIX}${repo}`)
      const branchName = `update-dependencies-${Date.now()}`

      try {
        await cloneRepo(owner, repo, tmpFolder)
        await updateDependencies(tmpFolder)
        await commitAndPush(tmpFolder, branchName)
        await createPullRequest(octokit, owner, repo, branchName)
        res.status(200).send('Dependencies update PR created successfully')
      } finally {
        await rm(tmpFolder, { recursive: true, force: true })
      }
    } catch (error) {
      console.error('Error updating dependencies:', error)
      res.status(500).send('Internal server error')
    }
  }
