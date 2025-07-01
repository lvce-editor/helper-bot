import { readFile, writeFile } from 'node:fs/promises'
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

const parseVersion = (content: string) => {
  if (content.startsWith('v')) {
    return parseInt(content.slice(1))
  }
  return parseInt(content)
}

const updateNvmrc = async (newVersion: string, root: string) => {
  try {
    const nvmrcPath = join(root, '.nvmrc')
    const content = await readFile(nvmrcPath, 'utf-8')
    const existingVersionNumber = parseVersion(content)
    const newVersionNumber = parseVersion(newVersion)
    if (existingVersionNumber > newVersionNumber) {
      return false
    }
    await writeFile(nvmrcPath, `${newVersion}\n`)
  } catch (error) {
    // File doesn't exist, skip
  }
  return true
}

const updateDockerfile = async (newVersion: string, root: string) => {
  try {
    const dockerfilePath = join(root, 'Dockerfile')
    const content = await readFile(dockerfilePath, 'utf-8')
    const updated = content.replaceAll(
      /node:\d+\.\d+\.\d+/g,
      `node:${newVersion.slice(1)}`,
    )
    await writeFile(dockerfilePath, updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

const updateGitpodDockerfile = async (newVersion: string, root: string) => {
  try {
    const gitpodPath = join(root, '.gitpod.Dockerfile')
    const content = await readFile(gitpodPath, 'utf-8')
    const updated = content.replaceAll(
      /(nvm \w+) \d+\.\d+\.\d+/g,
      `$1 ${newVersion.slice(1)}`,
    )
    await writeFile(gitpodPath, updated)
  } catch (error) {
    // File doesn't exist, skip
  }
}

interface UpdateNodeVersionParams {
  root: string
}

export const updateNodeVersion = async ({ root }: UpdateNodeVersionParams) => {
  const newVersion = await getLatestNodeVersion()
  const shouldContinueUpdating = await updateNvmrc(newVersion, root)
  if (!shouldContinueUpdating) {
    return
  }
  await Promise.all([
    updateDockerfile(newVersion, root),
    updateGitpodDockerfile(newVersion, root),
  ])
  return newVersion
}
