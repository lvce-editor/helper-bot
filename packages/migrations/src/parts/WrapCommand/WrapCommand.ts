import { execa } from 'execa'
import * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'

export const wrapCommand = <T extends BaseMigrationOptions>(command: (options: T) => Promise<MigrationResult>) => {
  return async (options: Omit<T, 'fs' | 'clonedRepoPath' | 'fetch' | 'exec'>): Promise<MigrationResult> => {
    const clonedRepo = await cloneRepositoryTmp(options.repositoryOwner, options.repositoryName)
    try {
      return await command({
        ...options,
        fs: FsPromises,
        clonedRepoPath: clonedRepo.path,
        fetch: globalThis.fetch,
        exec: execa,
      } as unknown as T)
    } finally {
      await clonedRepo[Symbol.asyncDispose]()
    }
  }
}

export const wrapResponseCommand = async (fn: () => Promise<Response>) => {
  try {
    const res = await fn()
    return {
      type: 'success',
      buffer: await res.arrayBuffer(),
      headers: [...res.headers.entries()],
    }
  } catch (error) {
    return {
      type: 'error',
      error: `${error}`,
    }
  }
}
