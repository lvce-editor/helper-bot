import type * as FsPromises from 'node:fs/promises'

export interface MockFsOptions {
  files?: Record<string, string>
}

export const createMockFs = (
  options: MockFsOptions = {},
): typeof FsPromises => {
  const files: Record<string, string> = { ...options.files }

  return {
    readFile: async (path: string | Buffer | URL, encoding?: string) => {
      const pathStr = typeof path === 'string' ? path : path.toString()
      if (files[pathStr] === undefined) {
        const error = new Error('ENOENT: no such file or directory')
        // @ts-ignore
        error.code = 'ENOENT'
        throw error
      }
      return files[pathStr]
    },
    writeFile: async (path: string | Buffer | URL, data: string | Buffer) => {
      const pathStr = typeof path === 'string' ? path : path.toString()
      const dataStr = typeof data === 'string' ? data : data.toString()
      files[pathStr] = dataStr
    },
    mkdir: async (path: string | Buffer | URL, options?: any) => {
      // Mock implementation - just track that directory exists
      const pathStr = typeof path === 'string' ? path : path.toString()
      if (!files[pathStr]) {
        files[pathStr] = '[DIRECTORY]'
      }
    },
    rm: async (path: string | Buffer | URL, options?: any) => {
      const pathStr = typeof path === 'string' ? path : path.toString()
      delete files[pathStr]
      // Also remove all files that start with this path
      Object.keys(files).forEach((key) => {
        if (key.startsWith(pathStr)) {
          delete files[key]
        }
      })
    },
    mkdtemp: async (prefix: string) => {
      const tempPath = `${prefix}${Math.random().toString(36).substring(7)}`
      files[tempPath] = '[DIRECTORY]'
      return tempPath
    },
  } as typeof FsPromises
}

