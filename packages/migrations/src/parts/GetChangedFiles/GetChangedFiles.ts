import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, ChangedFile } from '../Types/Types.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { parseGitStatus } from './ParseGitStatus.ts'

export interface GetChangedFilesOptions {
  readonly fs: Readonly<typeof FsPromises>
  readonly exec: BaseMigrationOptions['exec']
  readonly clonedRepoUri: string
  readonly filterStatus?: (status: string) => boolean
}

export const getChangedFiles = async (options: Readonly<GetChangedFilesOptions>): Promise<ChangedFile[]> => {
  const { fs, exec, clonedRepoUri, filterStatus } = options
  const baseUri = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'

  // Use git to detect changed files
  const gitResult = await exec('git', ['status', '--porcelain'], {
    cwd: clonedRepoUri,
  })

  const changedFiles: ChangedFile[] = []
  const parsedEntries = parseGitStatus(gitResult.stdout)

  for (const entry of parsedEntries) {
    const { status, filePath } = entry

    // Apply custom filter if provided, otherwise use default behavior
    if (filterStatus) {
      if (!filterStatus(status)) {
        continue
      }
    } else {
      // Default: skip deleted files (D in either position means deleted)
      if (status.includes('D')) {
        continue
      }
    }

    // Handle modified, added, untracked, or renamed files
    const fileUri = new URL(filePath, baseUri).toString()
    try {
      const content = await fs.readFile(fileUri, 'utf8')
      changedFiles.push({
        content,
        path: normalizePath(filePath),
      })
    } catch (error) {
      throw new Error(`Failed to read ${fileUri}: ${stringifyError(error)}`)
    }
  }

  return changedFiles
}
