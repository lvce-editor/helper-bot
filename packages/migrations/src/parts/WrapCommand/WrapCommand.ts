import { execa } from 'execa'
import { constants } from 'node:fs'
import * as FsPromises from 'node:fs/promises'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import type { BaseMigrationOptions, ExecFunction, MigrationResult } from '../Types/Types.ts'
import { uriToPath, validateUri } from '../UriUtils/UriUtils.ts'

const wrapExeca = (): ExecFunction => {
  return async (file: string, args?: readonly string[], options?: { cwd?: string }) => {
    const cwd = options?.cwd ? uriToPath(options.cwd) : undefined
    const result = await execa(file, args, { cwd })
    return {
      exitCode: result.exitCode ?? 0,
      stderr: result.stderr,
      stdout: result.stdout,
    }
  }
}

const wrapFs = (): typeof FsPromises => {
  return {
    ...FsPromises,
    exists: async (path: string | Buffer | URL): Promise<boolean> => {
      const uri = validateUri(path, 'exists', true)
      const filePath = uriToPath(uri)
      try {
        await FsPromises.access(filePath, constants.F_OK)
        return true
      } catch {
        return false
      }
    },
    mkdir: async (path: string | Buffer | URL, options?: any): Promise<string | undefined> => {
      const uri = validateUri(path, 'mkdir', true)
      const filePath = uriToPath(uri)
      return await FsPromises.mkdir(filePath, options)
    },
    readdir: async (path: string | Buffer | URL, options?: any): Promise<string[] | any[]> => {
      const uri = validateUri(path, 'readdir', true)
      const filePath = uriToPath(uri)
      return await FsPromises.readdir(filePath, options)
    },
    readFile: async (path: string | Buffer | URL, encoding?: BufferEncoding): Promise<string> => {
      const uri = validateUri(path, 'readFile', true)
      const filePath = uriToPath(uri)
      return await FsPromises.readFile(filePath, encoding)
    },
    rm: async (path: string | Buffer | URL, options?: any): Promise<void> => {
      const uri = validateUri(path, 'rm', true)
      const filePath = uriToPath(uri)
      return await FsPromises.rm(filePath, options)
    },
    writeFile: async (path: string | Buffer | URL, data: string | Buffer | Uint8Array, options?: BufferEncoding): Promise<void> => {
      const uri = validateUri(path, 'writeFile', true)
      const filePath = uriToPath(uri)
      return await FsPromises.writeFile(filePath, data, options)
    },
  } as typeof FsPromises & { exists: (path: string | Buffer | URL) => Promise<boolean> }
}

export const wrapCommand = <T extends BaseMigrationOptions>(command: (options: T) => Promise<MigrationResult>) => {
  return async (options: Omit<T, 'fs' | 'clonedRepoUri' | 'fetch' | 'exec'>): Promise<MigrationResult> => {
    const clonedRepo = await cloneRepositoryTmp(options.repositoryOwner, options.repositoryName)
    try {
      return await command({
        ...options,
        clonedRepoUri: clonedRepo.uri,
        exec: wrapExeca(),
        fetch: globalThis.fetch,
        fs: wrapFs(),
      } as unknown as T)
    } finally {
      await clonedRepo[Symbol.asyncDispose]()
    }
  }
}

export const wrapResponseCommand = (
  fn: () => Promise<Response>,
): (() => Promise<{ error?: string; headers?: Array<[string, string]>; text?: string; type: string }>) => {
  const wrapped = async (): Promise<{ error?: string; headers?: Array<[string, string]>; text?: string; type: string }> => {
    try {
      const res = await fn()
      return {
        headers: [...res.headers.entries()],
        text: await res.text(),
        type: 'success',
      }
    } catch (error) {
      let errorMessage: string
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (error && typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error)
        } catch {
          errorMessage = 'Unknown error'
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (typeof error === 'number' || typeof error === 'boolean') {
        errorMessage = String(error)
      } else {
        errorMessage = 'Unknown error'
      }
      return {
        error: errorMessage,
        type: 'error',
      }
    }
  }
  return wrapped
}
