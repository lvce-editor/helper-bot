export interface ComputeNewNvmrcContentParams {
  currentContent: string
  newVersion: string
}

export interface ComputeNewNvmrcContentResult {
  newContent: string
  shouldUpdate: boolean
}

const parseVersion = (content: string): number => {
  const trimmed = content.trim()
  if (trimmed.startsWith('v')) {
    return parseInt(trimmed.slice(1))
  }
  return parseInt(trimmed)
}

export const computeNewNvmrcContent = (
  params: ComputeNewNvmrcContentParams,
): ComputeNewNvmrcContentResult => {
  const { currentContent, newVersion } = params
  try {
    const existingVersionNumber = parseVersion(currentContent)
    const newVersionNumber = parseVersion(newVersion)
    if (existingVersionNumber > newVersionNumber) {
      return {
        newContent: currentContent,
        shouldUpdate: false,
      }
    }
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  } catch (error) {
    // If parsing fails, assume we should update
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  }
}
