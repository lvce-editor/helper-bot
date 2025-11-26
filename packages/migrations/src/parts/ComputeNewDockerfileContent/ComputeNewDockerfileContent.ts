export interface ComputeNewDockerfileContentParams {
  currentContent: string
  newVersion: string
}

export interface ComputeNewDockerfileContentResult {
  newContent: string
}

export const computeNewDockerfileContent = (
  params: ComputeNewDockerfileContentParams,
): ComputeNewDockerfileContentResult => {
  const { currentContent, newVersion } = params
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v')
    ? newVersion.slice(1)
    : newVersion
  const updated = currentContent.replaceAll(
    /node:\d+\.\d+\.\d+/g,
    `node:${versionWithoutPrefix}`,
  )
  return {
    newContent: updated,
  }
}
