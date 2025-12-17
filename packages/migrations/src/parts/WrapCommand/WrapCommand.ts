import { execa } from 'execa'
import * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'

export const wrapCommand = <T extends BaseMigrationOptions>(
  command: (options: T) => Promise<MigrationResult>,
) => {
  return async (
    options: Omit<T, 'fs' | 'clonedRepoPath' | 'fetch' | 'exec'>,
  ): Promise<MigrationResult> => {
    const clonedRepo = await cloneRepositoryTmp(
      options.repositoryOwner,
      options.repositoryName,
    )
    try {
      return await command({
        ...options,
        clonedRepoPath: clonedRepo.path,
        exec: execa,
        fetch: globalThis.fetch,
        fs: FsPromises,
      } as unknown as T)
    } finally {
      await clonedRepo[Symbol.asyncDispose]()
    }
  }
}
