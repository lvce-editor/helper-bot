import type * as FsPromises from 'node:fs/promises'

export interface ExecFunction {
  (file: string, args?: readonly string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export interface BaseMigrationOptions {
  [key: string]: any
  clonedRepoPath: string
  exec: ExecFunction
  fetch: typeof globalThis.fetch
  fs: typeof FsPromises
  repositoryName: string
  repositoryOwner: string
}

export interface ChangedFile {
  content: string
  path: string
}

export interface MigrationResult {
  changedFiles: ChangedFile[]
  errorCode?: string
  errorMessage?: string
  pullRequestTitle: string
  status: 'success' | 'error'
}
