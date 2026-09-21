import type * as FsPromises from 'node:fs/promises'
import type { ChangedFile } from '../Types/Types.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

export const readPackageFiles = async (fs: Readonly<typeof FsPromises>, rootUri: string, directory = ''): Promise<ChangedFile[]> => {
  const files: ChangedFile[] = []
  const entries = await fs.readdir(resolveUri(directory, rootUri), { withFileTypes: true })
  for (const entry of entries) {
    const path = `${directory}${entry.name}`
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      files.push(...(await readPackageFiles(fs, rootUri, `${path}/`)))
    } else if (entry.isFile() && (entry.name === 'package.json' || entry.name === 'package-lock.json')) {
      files.push({ content: await fs.readFile(resolveUri(path, rootUri), 'utf8'), path })
    }
  }
  return files
}
