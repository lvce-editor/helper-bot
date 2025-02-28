import { readFile, writeFile } from 'node:fs/promises'
import { Context } from 'probot'
import { join } from 'node:path'

interface NodeVersion {
  version: string
  lts: string | false
}

const getLatestNodeVersion = async (): Promise<string> => {
  const response = await fetch('https://nodejs.org/dist/index.json')
  // @ts-ignore
  const versions: NodeVersion[] = await response.json()
  const latestLts = versions.find((version) => version.lts)
  if (!latestLts) {
    throw new Error('No LTS version found')
  }
  return latestLts.version
}

const updateNvmrc = async (newVersion: string, root: string) => {
  try {
    const nvmrcPath = join(root, '.nvmrc')
    await readFile(nvmrcPath, 'utf-8')
    await writeFile(nvmrcPath, `${newVersion}\n`)
  } catch (error) {
    // File doesn't exist, skip
  }
}

const updateDockerfile = async (newVersion: string, root: string) => {
  try {
    const dockerfilePath = join(root, 'Dockerfile')
    const content = await readFile(dockerfilePath, 'utf-8')
    const updated = content.replace(
      /node:\d+\.\d+\.\d+/,
      `node:${newVersion.slice(1)}`,
    )
    await writeFile(dockerfilePath, updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

const updateGitpodDockerfile = async (newVersion: string, root: string) => {
  try {
    const gitpodPath = join(root, 'gitpod.Dockerfile')
    const content = await readFile(gitpodPath, 'utf-8')
    const updated = content.replace(
      /nvm install \d+\.\d+\.\d+/,
      `nvm install ${newVersion.slice(1)}`,
    )
    await writeFile(gitpodPath, updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

interface UpdateNodeVersionParams {
  owner: string
  repo: string
  octokit: Context<'release'>['octokit']
  root?: string
}

export const updateNodeVersion = async ({
  owner,
  repo,
  octokit,
  root = '.',
}: UpdateNodeVersionParams) => {
  const newVersion = await getLatestNodeVersion()
  await Promise.all([
    updateNvmrc(newVersion, root),
    updateDockerfile(newVersion, root),
    updateGitpodDockerfile(newVersion, root),
  ])
  return newVersion
}
