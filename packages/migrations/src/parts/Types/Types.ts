import type * as FsPromises from 'node:fs/promises'

export interface BaseMigrationOptions {
  repositoryOwner: string
  repositoryName: string
  fs: typeof FsPromises
  clonedRepoPath: string
  fetch: typeof globalThis.fetch
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
