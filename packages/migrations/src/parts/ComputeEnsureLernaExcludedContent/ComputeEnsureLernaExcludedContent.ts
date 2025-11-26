export interface ComputeEnsureLernaExcludedContentParams {
  currentContent: string
}

export interface ComputeEnsureLernaExcludedContentResult {
  newContent: string
  hasChanges: boolean
}

export const computeEnsureLernaExcludedContent = (
  params: ComputeEnsureLernaExcludedContentParams,
): ComputeEnsureLernaExcludedContentResult => {
  const { currentContent } = params

  // Check if the script contains any ncu commands
  const ncuRegex = /OUTPUT=`ncu -u(.*?)`/g
  const matches = [...currentContent.matchAll(ncuRegex)]

  if (matches.length === 0) {
    return {
      newContent: currentContent,
      hasChanges: false,
    }
  }

  let updatedContent = currentContent
  let hasChanges = false

  // Process each ncu command
  for (const match of matches) {
    const ncuCommand = match[1]

    // Check if lerna is already excluded
    if (!ncuCommand.includes('-x lerna')) {
      // Add lerna to the exclusion list
      let updatedCommand: string
      if (ncuCommand.trim() === '') {
        // No existing exclusions
        updatedCommand = ' -x lerna'
      } else {
        // Has existing exclusions, add lerna to the end
        updatedCommand = ncuCommand.replace(
          /(-x [^-]+)+$/,
          (match) => `${match} -x lerna`,
        )
      }

      updatedContent = updatedContent.replace(
        match[0],
        `OUTPUT=\`ncu -u${updatedCommand}\``,
      )
      hasChanges = true
    }
  }

  return {
    newContent: updatedContent,
    hasChanges,
  }
}
