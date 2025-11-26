import * as FsPromises from 'node:fs/promises'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

export const wrapCommand = <T extends BaseMigrationOptions>(
  command: (options: T) => Promise<MigrationResult>,
) => {
  return async (
    options: Omit<T, 'fs' | 'clonedRepoPath' | 'fetch'>,
  ): Promise<MigrationResult> => {
    const clonedRepo = await cloneRepositoryTmp(
      options.repositoryOwner,
      options.repositoryName,
    )
    try {
      return await command({
        ...options,
        fs: FsPromises,
        clonedRepoPath: clonedRepo.path,
        fetch: globalThis.fetch,
      } as T)
    } finally {
      await clonedRepo[Symbol.asyncDispose]()
    }
  }
}
