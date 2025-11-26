import type { ExecaReturnValue } from 'execa'
import type * as FsPromises from 'node:fs/promises'

export interface ExecFunction {
  (
    file: string,
    args?: readonly string[],
    options?: { cwd?: string },
  ): Promise<ExecaReturnValue>
}

export interface BaseMigrationOptions {
  repositoryOwner: string
  repositoryName: string
  fs: typeof FsPromises
  clonedRepoPath: string
  fetch: typeof globalThis.fetch
  exec: ExecFunction
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
