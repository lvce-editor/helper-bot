import type * as FsPromises from 'node:fs/promises'

export interface ExecFunction {
  (file: string, args?: readonly string[], options?: Readonly<{ cwd?: string }>): Promise<{ exitCode: number; stderr: string; stdout: string }>
}

export interface BaseMigrationOptions {
  readonly clonedRepoUri: string
  readonly exec: ExecFunction
  readonly fetch: typeof globalThis.fetch
  readonly fs: typeof FsPromises & { exists: (path: string | Readonly<Buffer> | Readonly<URL>) => Promise<boolean> }
  readonly [key: string]: any
  readonly repositoryName: string
  readonly repositoryOwner: string
}

export interface ChangedFile {
  readonly content: string
  readonly path: string
  readonly type?: 'deleted'
}

export interface MigrationSuccessResult {
  readonly branchName?: string
  readonly changedFiles: readonly ChangedFile[]
  readonly commitMessage?: string
  readonly data?: any
  readonly pullRequestTitle: string
  readonly status: 'success'
  readonly statusCode: number
}

export interface MigrationErrorResult {
  readonly changedFiles: readonly ChangedFile[]
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly status: 'error'
  readonly statusCode: number
}

export type MigrationResult = MigrationSuccessResult | MigrationErrorResult

export type MigrationSuccessResultWithoutStatusCode = Omit<MigrationSuccessResult, 'statusCode'>

export type MigrationErrorResultWithoutStatusCode = Omit<MigrationErrorResult, 'statusCode' | 'changedFiles'>

export type MigrationResultWithoutStatusCode = MigrationSuccessResultWithoutStatusCode | MigrationErrorResultWithoutStatusCode
