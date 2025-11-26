import type { Context } from 'probot'

export interface MigrationParams {
  octokit: Context<'release'>['octokit']
  owner: string
  repo: string
  baseBranch?: string
  migrationsRpc: {
    invoke: (method: string, ...args: any[]) => Promise<any>
    dispose: () => Promise<void>
  }
}

export interface MigrationResult {
  success: boolean
  changedFiles?: number
  newBranch?: string
  message?: string
  error?: string
}
