import { join } from 'node:path'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

const GITATTRIBUTES_CONTENT = '* text=auto eol=lf\n'

export type AddGitattributesOptions = BaseMigrationOptions

export const addGitattributes = async (options: Readonly<AddGitattributesOptions>): Promise<MigrationResult> => {
  try {
    const gitattributesPath = join(options.clonedRepoPath, '.gitattributes')

    // Check if .gitattributes already exists
    try {
      await options.fs.readFile(gitattributesPath, 'utf8')
      return createMigrationResult({
        status: 'success',
        changedFiles: [],
        pullRequestTitle: 'ci: add .gitattributes file',
      })
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        // File doesn't exist, create it
        await options.fs.writeFile(gitattributesPath, GITATTRIBUTES_CONTENT, 'utf8')
        return createMigrationResult({
          status: 'success',
          changedFiles: [
            {
              path: '.gitattributes',
              content: GITATTRIBUTES_CONTENT,
            },
          ],
          pullRequestTitle: 'ci: add .gitattributes file',
        })
      }
      throw error
    }
  } catch (error) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: 'ci: add .gitattributes file',
      errorCode: 'ADD_GITATTRIBUTES_FAILED',
      errorMessage: stringifyError(error),
    })
  }
}
