import type * as FsPromises from 'node:fs/promises'
import { validateUri } from '../UriUtils/UriUtils.ts'

export interface MockFsOptions {
  files?: Record<string, string>
}

class MockFs {
  files: Record<string, string>

  constructor(options: MockFsOptions = {}) {
    this.files = { ...options.files }
  }

  async readFile(path: string | Buffer | URL, encoding?: string): Promise<string> {
    const pathStr = validateUri(path, 'readFile', true)
    if (this.files[pathStr] === undefined) {
      const error = new Error('ENOENT: no such file or directory')
      // @ts-ignore
      error.code = 'ENOENT'
      throw error
    }
    return this.files[pathStr]
  }

  async writeFile(path: string | Buffer | URL, data: string | Buffer): Promise<void> {
    const pathStr = validateUri(path, 'writeFile')
    const dataStr = typeof data === 'string' ? data : data.toString()
    this.files[pathStr] = dataStr
  }

  async mkdir(path: string | Buffer | URL, options?: any): Promise<void> {
    // Mock implementation - just track that directory exists
    const pathStr = validateUri(path, 'mkdir')
    if (!this.files[pathStr]) {
      this.files[pathStr] = '[DIRECTORY]'
    }
  }

  async rm(path: string | Buffer | URL, options?: any): Promise<void> {
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

  async exists(path: string | Buffer | URL): Promise<boolean> {
    const pathStr = validateUri(path, 'exists', true)
    return this.files[pathStr] !== undefined
  }
}

export const createMockFs = (options: MockFsOptions = {}): typeof FsPromises & { exists: (path: string | Buffer | URL) => Promise<boolean> } => {
  return new MockFs(options) as unknown as typeof FsPromises & { exists: (path: string | Buffer | URL) => Promise<boolean> }
}
