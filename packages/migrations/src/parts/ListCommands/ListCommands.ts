import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { commandMap } from '../CommandMap/CommandMap.ts'

export type ListCommandsOptions = BaseMigrationOptions

export const listCommands = async (_options: Readonly<ListCommandsOptions>): Promise<MigrationResult> => {
  // Return the list of available command names
  const commands = Object.keys(commandMap)

  // We need to return a MigrationResult, but this is a special case
  // We'll encode the commands in the pullRequestTitle field as JSON
  return {
    changedFiles: [],
    pullRequestTitle: JSON.stringify({ commands }),
    status: 'success',
    statusCode: 200,
  }
}
