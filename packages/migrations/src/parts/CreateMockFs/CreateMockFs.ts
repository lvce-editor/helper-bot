import type * as FsPromises from 'node:fs/promises'
import { validateUri } from '../UriUtils/UriUtils.ts'

export interface MockFsOptions {
  files?: Record<string, string>
}

type MockPath = string | Readonly<Buffer> | Readonly<URL>

type MockFsResult = typeof FsPromises & { exists: (path: MockPath) => Promise<boolean> }

const hasOwnFile = (files: Record<string, string>, path: string): boolean => {
  return Object.hasOwn(files, path)
}

const isImplicitRootDirectory = (dirPath: string): boolean => {
  return dirPath.startsWith('file:///test/') || dirPath.startsWith('test:///')
}

const getRecursivePaths = (files: Record<string, string>, dirPath: string): string[] => {
  const recursivePaths: string[] = []
  const seen = new Set<string>()

  for (const filePath of Object.keys(files)) {
    if (filePath === dirPath || files[filePath] === '[DIRECTORY]' || !filePath.startsWith(dirPath)) {
      continue
    }

    const relativePath = filePath.slice(dirPath.length)
    if (!relativePath || seen.has(relativePath)) {
      continue
    }
    seen.add(relativePath)
    recursivePaths.push(relativePath)
  }

  return recursivePaths
}

const getDirectoryEntries = (files: Record<string, string>, dirPath: string): Array<{ name: string; isFile: () => boolean; isDirectory: () => boolean }> => {
  const entries: Array<{ name: string; isFile: () => boolean; isDirectory: () => boolean }> = []
  const seen = new Set<string>()

  for (const filePath of Object.keys(files)) {
    if (!filePath.startsWith(dirPath)) {
      continue
    }

    const relativePath = filePath.slice(dirPath.length)
    if (!relativePath) {
      continue
    }

    const firstSegment = relativePath.split('/')[0]
    if (seen.has(firstSegment)) {
      continue
    }
    seen.add(firstSegment)

    const isDirectory = relativePath.includes('/')
    entries.push({
      isDirectory: (): boolean => isDirectory,
      isFile: (): boolean => !isDirectory,
      name: firstSegment,
    })
  }

  return entries
}

class MockFs {
  files: Record<string, string>

  constructor(options: Readonly<MockFsOptions> = {}) {
    this.files = { ...options.files }
  }

  async readFile(path: MockPath, encoding?: string): Promise<string> {
    const pathStr = validateUri(path, 'readFile', true)
    if (!hasOwnFile(this.files, pathStr)) {
      const error = new Error('ENOENT: no such file or directory')
      // @ts-ignore
      error.code = 'ENOENT'
      throw error
    }
    return this.files[pathStr]
  }

  async writeFile(path: MockPath, data: string | Readonly<Buffer>): Promise<void> {
    const pathStr = validateUri(path, 'writeFile')
    const dataStr = typeof data === 'string' ? data : data.toString()
    this.files[pathStr] = dataStr
  }

  async mkdir(path: MockPath, options?: any): Promise<void> {
    // Mock implementation - just track that directory exists
    const pathStr = validateUri(path, 'mkdir')
    if (!this.files[pathStr]) {
      this.files[pathStr] = '[DIRECTORY]'
    }
  }

  async rm(path: MockPath, options?: any): Promise<void> {
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

  async exists(path: MockPath): Promise<boolean> {
    const pathStr = validateUri(path, 'exists', true)
    if (hasOwnFile(this.files, pathStr)) {
      return true
    }
    const dirPath = pathStr.endsWith('/') ? pathStr : pathStr + '/'
    return Object.keys(this.files).some((key) => key.startsWith(dirPath))
  }

  async readdir(path: MockPath, options?: Readonly<{ withFileTypes?: boolean; recursive?: boolean }>): Promise<any> {
    const pathStr = validateUri(path, 'readdir', true)
    const dirPath = pathStr.endsWith('/') ? pathStr : pathStr + '/'

    const hasDirectory = this.files[dirPath] === '[DIRECTORY]'
    const hasFiles = Object.keys(this.files).some((key) => key.startsWith(dirPath))
    if (!hasDirectory && !hasFiles && !isImplicitRootDirectory(dirPath)) {
      const error = new Error('ENOENT: no such file or directory')
      // @ts-ignore
      error.code = 'ENOENT'
      throw error
    }

    if (options?.recursive) {
      return getRecursivePaths(this.files, dirPath)
    }

    const entries = getDirectoryEntries(this.files, dirPath)

    if (options?.withFileTypes) {
      return entries
    }

    return entries.map((entry: Readonly<{ name: string }>) => entry.name)
  }
}

export const createMockFs = (options: Readonly<MockFsOptions> = {}): MockFsResult => {
  return new MockFs(options) as unknown as MockFsResult
}
