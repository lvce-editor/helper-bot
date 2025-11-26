export interface AddOidcPermissionsToWorkflowParams {
  content: string
}

export interface AddOidcPermissionsToWorkflowResult {
  updatedContent: string
}

export const addOidcPermissionsToWorkflow = (
  params: AddOidcPermissionsToWorkflowParams,
): AddOidcPermissionsToWorkflowResult => {
  const { content } = params
  // Check if permissions section already exists
  if (content.includes('permissions:')) {
    return {
      updatedContent: content,
    }
  }

  // Find the jobs section and add permissions before it
  const lines = content.split('\n')
  const jobsIndex = lines.findIndex((line) => line.trim().startsWith('jobs:'))

  if (jobsIndex === -1) {
    // If no jobs section found, add permissions at the end of the file
    lines.push('')
    lines.push('permissions:')
    lines.push('  id-token: write # Required for OIDC')
    lines.push('  contents: write')
    return {
      updatedContent: lines.join('\n'),
    }
  }

  // Insert permissions before the jobs section
  const newLines = [
    ...lines.slice(0, jobsIndex),
    '',
    'permissions:',
    '  id-token: write # Required for OIDC',
    '  contents: write',
    '',
    ...lines.slice(jobsIndex),
  ]

  return {
    updatedContent: newLines.join('\n'),
  }
}
