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

export interface Migration {
  name: string
  description: string
  run: (params: MigrationParams) => Promise<MigrationResult>
}

export interface MigrationEndpointParams {
  app: any
  secret: string | undefined
  migrationsRpc: {
    invoke: (method: string, ...args: any[]) => Promise<any>
    dispose: () => Promise<void>
  }
}
