interface NpmPackageInfo {
  version: string
}

export const getLatestNpmVersion = async (packageName: string, fetchFn: typeof globalThis.fetch): Promise<string> => {
  const response = await fetchFn(`https://registry.npmjs.org/${packageName}/latest`)
  if (!response.ok) {
    throw new Error(`Failed to fetch latest version for ${packageName}: ${response.statusText}`)
  }
  const packageInfo = (await response.json()) as NpmPackageInfo
  return packageInfo.version
}
