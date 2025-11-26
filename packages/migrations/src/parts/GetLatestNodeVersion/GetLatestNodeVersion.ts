interface NodeVersion {
  version: string
  lts: string | false
}

export const getLatestNodeVersion = async (): Promise<string> => {
  const response = await fetch('https://nodejs.org/dist/index.json')
  // @ts-ignore
  const versions: NodeVersion[] = await response.json()
  const latestLts = versions.find((version) => version.lts)
  if (!latestLts) {
    throw new Error('No LTS version found')
  }
  return latestLts.version
}
