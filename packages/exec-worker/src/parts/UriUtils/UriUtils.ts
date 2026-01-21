/* eslint-disable @typescript-eslint/no-base-to-string */
import { fileURLToPath, pathToFileURL } from 'node:url'

export const pathToUri = (path: string): string => {
  try {
    // If it's already a URI, return it
    if (path.startsWith('file://')) {
      return path
    }
    // Convert path to file:// URI
    return pathToFileURL(path).href
  } catch {
    // If pathToFileURL fails, assume it's a relative path and normalize it
    return normalizePath(path)
  }
}

export const uriToPath = (uri: string): string => {
  if (uri.startsWith('file://')) {
    return fileURLToPath(uri)
  }
  return uri
}

export const normalizePath = (path: string): string => {
  // Normalize path separators to forward slashes
  return path.replaceAll('\\', '/')
}

export const isUri = (path: string): boolean => {
  return path.startsWith('file://') || (!path.includes('\\') && path.includes('/'))
}

export const validateUri = (path: string | Readonly<Buffer> | Readonly<URL>, operation: string, strict: boolean = false): string => {
  if (path instanceof URL) {
    const uri = path.href
    if (strict && !uri.startsWith('file://')) {
      throw new Error(`${operation} requires a file:// URI, but received: ${uri}. Use pathToUri() to convert.`)
    }
    return uri
  }
  if (path instanceof Buffer) {
    throw new TypeError(`${operation} requires a URI, but received a Buffer. Convert to URI first.`)
  }
  const pathStr = path.toString()

  // Strict mode: only accept file:// URIs
  if (strict) {
    if (!pathStr.startsWith('file://')) {
      throw new Error(`${operation} requires a file:// URI string, but received: ${pathStr}. Use pathToUri() to convert.`)
    }
    return pathStr
  }

  // Non-strict mode: allow relative paths and normalize them
  // Check if it looks like a file path (has backslashes on Windows)
  if (pathStr.includes('\\') && !pathStr.startsWith('file://')) {
    throw new Error(`${operation} requires a URI, but received a file path: ${pathStr}. Use pathToUri() to convert.`)
  }
  // If it's not a file:// URI but is a relative path, that's okay (normalize it)
  if (!pathStr.startsWith('file://') && !pathStr.startsWith('/')) {
    return normalizePath(pathStr)
  }
  return pathStr
}
