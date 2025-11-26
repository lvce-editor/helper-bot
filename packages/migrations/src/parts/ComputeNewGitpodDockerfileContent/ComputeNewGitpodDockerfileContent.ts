export interface ComputeNewGitpodDockerfileContentParams {
  currentContent: string
  newVersion: string
}

export interface ComputeNewGitpodDockerfileContentResult {
  newContent: string
}

export const computeNewGitpodDockerfileContent = (
  params: ComputeNewGitpodDockerfileContentParams,
): ComputeNewGitpodDockerfileContentResult => {
  const { currentContent, newVersion } = params
  // Remove 'v' prefix from version if present (e.g., 'v20.0.0' -> '20.0.0')
  const versionWithoutPrefix = newVersion.startsWith('v')
    ? newVersion.slice(1)
    : newVersion
  const updated = currentContent.replaceAll(
    /(nvm [\w\s]+) \d+\.\d+\.\d+/g,
    `$1 ${versionWithoutPrefix}`,
  )
  return {
    newContent: updated,
  }
}
