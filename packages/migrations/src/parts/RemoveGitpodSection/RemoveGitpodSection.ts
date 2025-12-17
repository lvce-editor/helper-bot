import { join } from 'node:path'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

const removeGitpodSectionContent = (content: Readonly<string>): string => {
  // Pattern to match Gitpod sections in README
  // This matches sections that start with ## Gitpod or similar headers
  // and includes content until the next header or end of file
  const gitpodPattern = /^#{1,6}\s*[Gg]itpod.*?(?=^#{1,6}\s|\Z)/gms

  return content.replaceAll(gitpodPattern, '')
}

export type RemoveGitpodSectionOptions = BaseMigrationOptions

export const removeGitpodSection = async (options: Readonly<RemoveGitpodSectionOptions>): Promise<MigrationResult> => {
  try {
    const readmePaths = ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'readme.MD']
    const changedFiles: Array<{ path: string; content: string }> = []

    for (const readmePath of readmePaths) {
      const fullPath = join(options.clonedRepoPath, readmePath)

      let originalContent: string
      try {
        originalContent = await options.fs.readFile(fullPath, 'utf8')
      } catch (error: any) {
        if (error && error.code === 'ENOENT') {
          // File doesn't exist, skip
          continue
        }
        throw error
      }

      const updatedContent = removeGitpodSectionContent(originalContent)
      const hasChanges = originalContent !== updatedContent

      if (hasChanges) {
        changedFiles.push({
          path: readmePath,
          content: updatedContent,
        })
      }
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    const pullRequestTitle = 'ci: remove Gitpod section from README'

    return createMigrationResult({
      status: 'success',
      changedFiles,
      pullRequestTitle,
    })
  } catch (error) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: 'ci: remove Gitpod section from README',
      errorCode: ERROR_CODES.REMOVE_GITPOD_SECTION_FAILED,
      errorMessage: stringifyError(error),
    })
  }
}
