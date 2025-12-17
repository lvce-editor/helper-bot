import type { BaseMigrationOptions, MigrationResult, MigrationSuccessResult } from '../Types/Types.ts'
import { commandMap } from '../CommandMap/CommandMap.ts'
import { emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export type ListCommandsOptions = BaseMigrationOptions

export const listCommands = async (_options: Readonly<ListCommandsOptions>): Promise<MigrationResult> => {
  // Return the list of available command names

  // We need to return a MigrationResult, but this is a special case
  // We'll encode the commands in the pullRequestTitle field as JSON
  const commands = Object.keys(commandMap)
  const result: MigrationSuccessResult = {
    ...emptyMigrationResult,
    pullRequestTitle: JSON.stringify({ commands }),
  }
  return result
}
