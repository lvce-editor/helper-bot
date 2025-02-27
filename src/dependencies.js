import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

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
  const { execa } = await import('execa')
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
  const { execa } = await import('execa')
  await execa('bash', [scriptPath], {
    cwd: tmpFolder,
  })
}

/**
 * @type {'100644'}
 */
const modeFile = '100644'
/**
 * @type {'blob'}
 */
const typeFile = 'blob'

/**
 * Commit and push the changes
 * @param {string} tmpFolder
 * @param {string} branchName
 * @param {import('probot').Context<"release">['octokit']} octokit
 * @param {string} owner
 * @param {string} repo
 */
const commitAndPush = async (tmpFolder, branchName, octokit, owner, repo) => {
  const { execa } = await import('execa')
  const { stdout } = await execa('git', ['status', '--porcelain'], {
    cwd: tmpFolder,
  })

  if (!stdout) {
    return false
  }

  const mainBranchRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: 'heads/main',
  })

  const latestCommit = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: mainBranchRef.data.object.sha,
  })

  const changedFiles = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))

  const tree = await Promise.all(
    changedFiles.map(async (file) => {
      const content = await readFile(join(tmpFolder, file), 'utf8')
      return {
        path: file,
        mode: modeFile,
        type: typeFile,
        content,
      }
    }),
  )

  const newTree = await octokit.rest.git.createTree({
    owner,
    repo,
    tree,
    base_tree: latestCommit.data.sha,
  })

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: 'update dependencies',
    tree: newTree.data.sha,
    parents: [latestCommit.data.sha],
  })

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: commit.data.sha,
  })

  return true
}

/**
 * Handle the dependencies update
 * @param {{ app: import('probot').Probot, secret: string, installationId:number }} params
 */
export const handleDependencies =
  ({ app, secret, installationId }) =>
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async (req, res) => {
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
        await commitAndPush(tmpFolder, branchName, octokit, owner, repo)
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
