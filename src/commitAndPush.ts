import { Context } from 'probot'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { VError } from '@lvce-editor/verror'

const modeFile: '100644' = '100644'
const typeFile: 'blob' = 'blob'

export const commitAndPush = async (
  tmpFolder: string,
  branchName: string,
  octokit: Context<'release'>['octokit'],
  owner: string,
  repo: string,
  options: {
    commitMessage?: string
    createNewBranch?: boolean
    baseBranch?: string
  } = {},
): Promise<boolean> => {
  const { stdout } = await execa('git', ['status', '--porcelain'], {
    cwd: tmpFolder,
  })

  if (!stdout) {
    return false
  }

  const {
    commitMessage = 'update dependencies',
    createNewBranch = true,
    baseBranch = 'main',
  } = options

  const branchRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${createNewBranch ? baseBranch : branchName}`,
  })

  const latestCommit = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: branchRef.data.object.sha,
  })

  const changedFiles = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))

  const absolutePaths = changedFiles.map((file) => join(tmpFolder, file))
  for (const path of absolutePaths) {
    if (!existsSync(path)) {
      throw new Error(`path ${path} does not exist`)
    }
  }

  const tree = await Promise.all(
    changedFiles.map(async (path) => {
      const absolutePath = join(tmpFolder, path)
      const content = await readFile(absolutePath, 'utf8')
      return {
        path,
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
    message: commitMessage,
    tree: newTree.data.sha,
    parents: [latestCommit.data.sha],
  })

  if (createNewBranch) {
    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: commit.data.sha,
      })
    } catch (error) {
      throw new VError(error, `Failed to create new branch`)
    }
  } else {
    try {
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: commit.data.sha,
        force: true,
      })
    } catch (error) {
      throw new VError(error, `Failed to update branch`)
    }
  }

  return true
}
