interface NodeVersion {
  lts: string | false
  version: string
}

export const getLatestNodeVersion = async (fetchFn: typeof globalThis.fetch): Promise<string> => {
  const response = await fetchFn('https://nodejs.org/dist/index.json')
  // @ts-ignore
  const versions: NodeVersion[] = await response.json()
  const latestLts = versions.find((version) => version.lts)
  if (!latestLts) {
    throw new Error('No LTS version found')
  }
  return latestLts.version
}
