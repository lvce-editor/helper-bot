// Mapping of endpoint names to RPC method names
// The key is the endpoint name (kebab-case), the value is the RPC method name (camelCase)
export const MIGRATION_MAP: Record<string, string> = {
  'add-oidc-permissions': 'addOidcPermissionsToWorkflow',
  'remove-npm-token': 'removeNpmTokenFromWorkflow',
  'ensure-lerna-excluded': 'computeEnsureLernaExcludedContent',
  'update-node-version': 'updateNodeVersion',
  'update-dependencies': 'updateDependencies',
  'add-gitattributes': 'addGitattributes',
  'update-github-actions': 'updateGithubActions',
}

// Migrations that need special handling (not yet moved to RPC)
export const SPECIAL_MIGRATIONS: string[] = []

export const getAvailableMigrations = async (migrationsRpc: {
  invoke: (method: string, ...args: any[]) => Promise<any>
  dispose: () => Promise<void>
}): Promise<{
  migrations: string[]
  special: string[]
  allRpcCommands: string[]
}> => {
  // Query the migrations worker for available commands
  let allRpcCommands: string[] = []
  try {
    const result = await migrationsRpc.invoke('listCommands', {
      repositoryOwner: 'dummy',
      repositoryName: 'dummy',
    })
    if (result.status === 'success' && result.pullRequestTitle) {
      const parsed = JSON.parse(result.pullRequestTitle)
      if (parsed.commands && Array.isArray(parsed.commands)) {
        allRpcCommands = parsed.commands.filter(
          (cmd: string) => cmd !== 'listCommands',
        )
      }
    }
  } catch (error) {
    console.warn('Failed to query available migrations from RPC:', error)
    // Fallback to known commands
    allRpcCommands = Object.values(MIGRATION_MAP)
  }

  return {
    migrations: Object.keys(MIGRATION_MAP),
    special: SPECIAL_MIGRATIONS,
    allRpcCommands,
  }
}
