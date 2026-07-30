import { fileURLToPath } from 'node:url'

export const uriToPath = (uri: string): string => {
  if (uri.startsWith('file://')) {
    return fileURLToPath(uri)
  }
  return uri
}
