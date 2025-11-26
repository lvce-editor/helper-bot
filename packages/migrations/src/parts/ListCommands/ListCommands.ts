import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { commandMap } from '../CommandMap/CommandMap.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export type ListCommandsOptions = BaseMigrationOptions

export const listCommands = async (
  _options: Readonly<ListCommandsOptions>,
): Promise<MigrationResult> => {
  // Return the list of available command names
  const commands = Object.keys(commandMap)

  // We need to return a MigrationResult, but this is a special case
  // We'll encode the commands in the pullRequestTitle field as JSON
  return createMigrationResult({
    status: 'success',
    changedFiles: [],
    pullRequestTitle: JSON.stringify({ commands }),
  })
}
