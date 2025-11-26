export interface BaseMigrationOptions {
  repository: string
  [key: string]: any
}

export interface ChangedFile {
  path: string
  content: string
}

export interface MigrationResult {
  status: 'success' | 'error'
  changedFiles: ChangedFile[]
  pullRequestTitle: string
  errorCode?: string
  errorMessage?: string
}
