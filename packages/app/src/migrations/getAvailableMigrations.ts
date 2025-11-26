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
  let migrations: string[] = []
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
        // Extract migration endpoints (commands that start with 'migrations/')
        migrations = allRpcCommands
          .filter((cmd: string) => cmd.startsWith('migrations/'))
          .map((cmd: string) => cmd.replace('migrations/', ''))
      }
    }
  } catch (error) {
    console.warn('Failed to query available migrations from RPC:', error)
  }

  return {
    migrations,
    special: SPECIAL_MIGRATIONS,
    allRpcCommands,
  }
}
