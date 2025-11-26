import type { Context } from 'probot'

export interface MigrationParams {
  octokit: Context<'release'>['octokit']
  owner: string
  repo: string
  baseBranch?: string
}

export interface MigrationResult {
  status: 'success' | 'error'
  changedFiles: number
  pullRequestTitle: string
  errorCode?: string
  errorMessage?: string
  newBranch?: string
  message?: string
}

export interface Migration {
  name: string
  description: string
  run: (params: MigrationParams) => Promise<MigrationResult>
}

export interface MigrationEndpointParams {
  app: any
  secret: string | undefined
}
