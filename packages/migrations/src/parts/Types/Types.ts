import type * as FsPromises from 'node:fs/promises'

export interface ExecFunction {
  (file: string, args?: readonly string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export interface BaseMigrationOptions {
  readonly repositoryOwner: string
  readonly repositoryName: string
  readonly fs: typeof FsPromises
  readonly clonedRepoPath: string
  readonly fetch: typeof globalThis.fetch
  readonly exec: ExecFunction
  readonly [key: string]: any
}

export interface ChangedFile {
  readonly path: string
  readonly content: string
}

export interface MigrationResult {
  readonly status: 'success' | 'error'
  readonly changedFiles: ChangedFile[]
  readonly pullRequestTitle: string
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly statusCode: number
}
