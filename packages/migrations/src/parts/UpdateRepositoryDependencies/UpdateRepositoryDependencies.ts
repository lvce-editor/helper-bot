import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export interface UpdateRepositoryDependenciesOptions extends BaseMigrationOptions {
  repositoryName: string
  tagName: string
}

export const updateRepositoryDependencies = async (_options: Readonly<UpdateRepositoryDependenciesOptions>): Promise<MigrationResult> => {
  // Dependency update dispatching is handled by the app release webhook.
  return emptyMigrationResult
}
