export interface RemoveNpmTokenFromWorkflowParams {
  content: string
}

export interface RemoveNpmTokenFromWorkflowResult {
  updatedContent: string
}

export const removeNpmTokenFromWorkflow = (
  params: RemoveNpmTokenFromWorkflowParams,
): RemoveNpmTokenFromWorkflowResult => {
  const { content } = params
  // Pattern to match the env section with NODE_AUTH_TOKEN
  // This matches the exact pattern: env: followed by NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
  const npmTokenPattern =
    /^\s*env:\s*\n\s*NODE_AUTH_TOKEN:\s*\${{secrets\.NPM_TOKEN}}\s*$/gm

  const updatedContent = content.replace(npmTokenPattern, '')

  return {
    updatedContent,
  }
}
