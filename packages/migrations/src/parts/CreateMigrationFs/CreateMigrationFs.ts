import type * as FsPromises from 'node:fs/promises'
import type { MigrationFs, ReadFileResult } from '../Types/Types.ts'

export const createMigrationFs = (nodeFs: typeof FsPromises): MigrationFs => {
  return {
    mkdir: nodeFs.mkdir,
    mkdtemp: nodeFs.mkdtemp,
    readdir: nodeFs.readdir,
    readFile: async (path: string | Buffer | URL, encoding?: string): Promise<ReadFileResult> => {
      try {
        const content = await nodeFs.readFile(path, encoding as BufferEncoding)
        return {
          content: content,
          error: null,
        }
      } catch (error) {
        return {
          content: null,
          error: error as Error,
        }
      }
    },
    rm: nodeFs.rm,
    writeFile: nodeFs.writeFile,
  }
}
