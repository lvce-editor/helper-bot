import type * as FsPromises from 'node:fs/promises'
import { validateUri } from '../UriUtils/UriUtils.ts'

export interface MockFsOptions {
  files?: Record<string, string>
}

class MockFs {
  files: Record<string, string>

  constructor(options: Readonly<MockFsOptions> = {}) {
    this.files = { ...options.files }
  }

  async readFile(path: string | Readonly<Buffer> | Readonly<URL>, encoding?: string): Promise<string> {
    const pathStr = validateUri(path, 'readFile', true)
    if (this.files[pathStr] === undefined) {
      const error = new Error('ENOENT: no such file or directory')
      // @ts-ignore
      error.code = 'ENOENT'
      throw error
    }
    return this.files[pathStr]
  }

  async writeFile(path: string | Readonly<Buffer> | Readonly<URL>, data: string | Readonly<Buffer>): Promise<void> {
    const pathStr = validateUri(path, 'writeFile')
    const dataStr = typeof data === 'string' ? data : data.toString()
    this.files[pathStr] = dataStr
  }

  async mkdir(path: string | Readonly<Buffer> | Readonly<URL>, options?: any): Promise<void> {
    // Mock implementation - just track that directory exists
    const pathStr = validateUri(path, 'mkdir')
    if (!this.files[pathStr]) {
      this.files[pathStr] = '[DIRECTORY]'
    }
  }

  async rm(path: string | Readonly<Buffer> | Readonly<URL>, options?: any): Promise<void> {
    const pathStr = validateUri(path, 'rm')
    delete this.files[pathStr]
    // Also remove all files that start with this path
    for (const key of Object.keys(this.files)) {
      if (key.startsWith(pathStr)) {
        delete this.files[key]
      }
    }
  }

  async mkdtemp(prefix: string): Promise<string> {
    const tempPath = `${prefix}${Math.random().toString(36).slice(7)}`
    this.files[tempPath] = '[DIRECTORY]'
    return tempPath
  }

  async exists(path: string | Readonly<Buffer> | Readonly<URL>): Promise<boolean> {
    const pathStr = validateUri(path, 'exists', true)
    if (this.files[pathStr] !== undefined) {
      return true
    }
    // Check if it's a directory by seeing if any files exist under this path
    const dirPath = pathStr.endsWith('/') ? pathStr : pathStr + '/'
    return Object.keys(this.files).some((key) => key.startsWith(dirPath))
  }

  async readdir(path: string | Readonly<Buffer> | Readonly<URL>, options?: Readonly<{ withFileTypes?: boolean; recursive?: boolean }>): Promise<any> {
    const pathStr = validateUri(path, 'readdir', true)
    // Ensure path ends with /
    const dirPath = pathStr.endsWith('/') ? pathStr : pathStr + '/'

    // Check if directory exists
    if (!this.files[dirPath] && this.files[dirPath] !== '[DIRECTORY]') {
      // Check if any files exist under this directory
      const hasFiles = Object.keys(this.files).some((key) => key.startsWith(dirPath))
      if (!hasFiles) {
        // For the root directory in tests, we should allow it even if not explicitly created
        if (dirPath.startsWith('file:///test/') || dirPath.startsWith('test:///')) {
          // Root directory exists implicitly
        } else {
          const error = new Error('ENOENT: no such file or directory')
          // @ts-ignore
          error.code = 'ENOENT'
          throw error
        }
      }
    }

    // If recursive is true, return all file paths recursively
    if (options?.recursive) {
      const recursivePaths: string[] = []
      const seen = new Set<string>()

      for (const filePath of Object.keys(this.files)) {
        if (filePath === dirPath || this.files[filePath] === '[DIRECTORY]') {
          continue
        }

        if (!filePath.startsWith(dirPath)) {
          continue
        }

        const relativePath = filePath.slice(dirPath.length)
        if (!relativePath) {
          continue
        }

        // For recursive, we want the full relative path
        if (!seen.has(relativePath)) {
          seen.add(relativePath)
          recursivePaths.push(relativePath)
        }
      }

      return recursivePaths
    }

    // Get all entries in this directory (not recursive)
    const entries: Array<{ name: string; isFile: () => boolean; isDirectory: () => boolean }> = []
    const seen = new Set<string>()

    for (const filePath of Object.keys(this.files)) {
      if (!filePath.startsWith(dirPath)) {
        continue
      }

      const relativePath = filePath.slice(dirPath.length)
      if (!relativePath) {
        continue
      }

      // Get the first segment (either a file or a directory)
      const firstSegment = relativePath.split('/')[0]
      if (seen.has(firstSegment)) {
        continue
      }
      seen.add(firstSegment)

      const isDirectory = relativePath.includes('/')
      const entry = {
        isDirectory: (): boolean => isDirectory,
        isFile: (): boolean => !isDirectory,
        name: firstSegment,
      }
      entries.push(entry)
    }

    if (options?.withFileTypes) {
      return entries
    }

    return entries.map((entry: Readonly<{ name: string }>) => entry.name)
  }
}

export const createMockFs = (
  options: Readonly<MockFsOptions> = {},
): typeof FsPromises & { exists: (path: string | Readonly<Buffer> | Readonly<URL>) => Promise<boolean> } => {
  return new MockFs(options) as unknown as typeof FsPromises & { exists: (path: string | Readonly<Buffer> | Readonly<URL>) => Promise<boolean> }
}
