import type * as FsPromises from 'node:fs/promises'

export interface ExecFunction {
  (file: string, args?: readonly string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export interface BaseMigrationOptions {
  readonly clonedRepoPath: string
  readonly exec: ExecFunction
  readonly fetch: typeof globalThis.fetch
  readonly fs: typeof FsPromises
  readonly [key: string]: any
  readonly repositoryName: string
  readonly repositoryOwner: string
}

export interface ChangedFile {
  readonly content: string
  readonly path: string
}

export interface MigrationResult {
  readonly changedFiles: ChangedFile[]
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly pullRequestTitle: string
  readonly status: 'success' | 'error'
  readonly statusCode: number
}
