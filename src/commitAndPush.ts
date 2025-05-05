import { Context } from 'probot'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const modeFile: '100644' = '100644'
const typeFile: 'blob' = 'blob'

export const commitAndPush = async (
  tmpFolder: string,
  branchName: string,
  octokit: Context<'release'>['octokit'],
  owner: string,
  repo: string,
) => {
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
