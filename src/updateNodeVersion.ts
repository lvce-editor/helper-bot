import { readFile, writeFile } from 'node:fs/promises'
import { Context } from 'probot'

interface NodeVersion {
  version: string
  lts: string | false
}

const getLatestNodeVersion = async (): Promise<string> => {
  const response = await fetch('https://nodejs.org/dist/index.json')
  // @ts-ignore
  const versions: NodeVersion[] = await response.json()
  return versions[0].version
}

const updateNvmrc = async (newVersion: string) => {
  try {
    await readFile('.nvmrc', 'utf-8')
    await writeFile('.nvmrc', `${newVersion}\n`)
  } catch (error) {
    // File doesn't exist, skip
  }
}

const updateDockerfile = async (newVersion: string) => {
  try {
    const content = await readFile('Dockerfile', 'utf-8')
    const updated = content.replace(
      /node:\d+\.\d+\.\d+/,
      `node:${newVersion.slice(1)}`,
    )
    await writeFile('Dockerfile', updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

const updateGitpodDockerfile = async (newVersion: string) => {
  try {
    const content = await readFile('gitpod.Dockerfile', 'utf-8')
    const updated = content.replace(
      /nvm install \d+\.\d+\.\d+/,
      `nvm install ${newVersion.slice(1)}`,
    )
    await writeFile('gitpod.Dockerfile', updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

interface UpdateNodeVersionParams {
  owner: string
  repo: string
  octokit: Context<'release'>['octokit']
}

export const updateNodeVersion = async ({
  owner,
  repo,
  octokit,
}: UpdateNodeVersionParams) => {
  const newVersion = await getLatestNodeVersion()
  await Promise.all([
    updateNvmrc(newVersion),
    updateDockerfile(newVersion),
    updateGitpodDockerfile(newVersion),
  ])
  return newVersion
}
