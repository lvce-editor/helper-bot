import { multiMigrations } from '../MultiMigrations/MultiMigrations.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export interface MultiMigrationsUpdateNodeVersionOptions extends BaseMigrationOptions {
  readonly baseBranch?: string
  readonly repositoryNames: readonly string[]
  readonly secret?: string
  readonly serverUrl?: string
}

export interface RepositoryResult {
  readonly error?: string
  readonly message?: string
  readonly repository: string
  readonly success: boolean
}

export interface MultiMigrationsUpdateNodeVersionData {
  readonly failed: number
  readonly results: readonly RepositoryResult[]
  readonly successful: number
  readonly total: number
}

export const multiMigrationsUpdateNodeVersion = async (options: Readonly<MultiMigrationsUpdateNodeVersionOptions>): Promise<MigrationResult> => {
  return multiMigrations({
    ...options,
    migrationName: 'update-node-version',
  })
}
