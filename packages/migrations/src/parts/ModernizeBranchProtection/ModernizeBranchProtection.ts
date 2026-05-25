import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

export interface ModernizeBranchProtectionOptions extends BaseMigrationOptions {
  readonly branch?: string
  readonly githubToken: string
}

export const modernizeBranchProtection = async (options: ModernizeBranchProtectionOptions): Promise<MigrationResult> => {
  const { branch = 'main' } = options

  return createMigrationResult({
    changedFiles: [],
    data: {
      branch,
      message: 'Queued branch protection modernization',
    },
    pullRequestTitle: '',
    repoCommands: [
      {
        branch,
        type: 'modernize-branch-protection',
      },
    ],
    status: 'success',
  })
}
