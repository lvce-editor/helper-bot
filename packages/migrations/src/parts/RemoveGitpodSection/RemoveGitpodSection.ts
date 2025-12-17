import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

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
          content: updatedContent,
          path: readmePath,
        })
      }
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    const pullRequestTitle = 'ci: remove Gitpod section from README'

    return {
      branchName: 'feature/remove-gitpod-section',
      changedFiles,
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return createMigrationResult({
      branchName: '',
      changedFiles: [],
      commitMessage: '',
      errorCode: ERROR_CODES.REMOVE_GITPOD_SECTION_FAILED,
      errorMessage: stringifyError(error),
      pullRequestTitle: 'ci: remove Gitpod section from README',
      status: 'error',
    })
  }
}
