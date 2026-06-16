import config from './config.json' with { type: 'json' }

interface NodeVersion {
  lts: string | false
  version: string
}

const parseNodeVersion = (version: string): readonly number[] => {
  const normalized = version.trim().replace(/^v/, '')
  const parts = normalized.split('.')
  if (parts.length !== 3) {
    throw new Error(`Invalid Node.js version: ${version}`)
  }
  const parsed = parts.map((part) => Number.parseInt(part, 10))
  if (parsed.some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid Node.js version: ${version}`)
  }
  return parsed
}

export const compareNodeVersions = (a: string, b: string): number => {
  const aParts = parseNodeVersion(a)
  const bParts = parseNodeVersion(b)
  for (let i = 0; i < aParts.length; i++) {
    const difference = aParts[i] - bParts[i]
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

export const getLatestNodeVersion = async (fetchFn: typeof globalThis.fetch): Promise<string> => {
  const response = await fetchFn('https://nodejs.org/dist/index.json')
  // @ts-ignore
  const versions: NodeVersion[] = await response.json()
  const latestLts = versions.find((version) => version.lts && compareNodeVersions(version.version, config.maxNodeJsVersion) <= 0)
  if (!latestLts) {
    throw new Error(`No LTS version found at or below ${config.maxNodeJsVersion}`)
  }
  return latestLts.version
}
