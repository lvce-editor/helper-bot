import { join } from 'node:path'
<<<<<<< HEAD
import { createMigrationResult, emptyMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
=======
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
>>>>>>> origin/main
import { stringifyError } from '../StringifyError/StringifyError.ts'

const GITATTRIBUTES_CONTENT = '* text=auto eol=lf\n'

export type AddGitattributesOptions = BaseMigrationOptions

export const addGitattributes = async (options: Readonly<AddGitattributesOptions>): Promise<MigrationResult> => {
  try {
    const gitattributesPath = join(options.clonedRepoPath, '.gitattributes')

    // Check if .gitattributes already exists
    try {
      await options.fs.readFile(gitattributesPath, 'utf8')
<<<<<<< HEAD
      return emptyMigrationResult
=======
      return {
        changedFiles: [],
        pullRequestTitle: 'ci: add .gitattributes file',
        status: 'success',
        statusCode: 200,
      }
>>>>>>> origin/main
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        // File doesn't exist, create it
        await options.fs.writeFile(gitattributesPath, GITATTRIBUTES_CONTENT, 'utf8')
        return {
          changedFiles: [
            {
              content: GITATTRIBUTES_CONTENT,
              path: '.gitattributes',
            },
          ],
          pullRequestTitle: 'ci: add .gitattributes file',
          status: 'success',
          statusCode: 200,
        }
      }
      throw error
    }
  } catch (error) {
    return createMigrationResult({
      changedFiles: [],
      errorCode: 'ADD_GITATTRIBUTES_FAILED',
      errorMessage: stringifyError(error),
      pullRequestTitle: 'ci: add .gitattributes file',
      status: 'error',
    })
  }
}
