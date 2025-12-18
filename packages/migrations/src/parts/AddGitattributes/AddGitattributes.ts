import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const GITATTRIBUTES_CONTENT = '* text=auto eol=lf\n'

export type AddGitattributesOptions = BaseMigrationOptions

export const addGitattributes = async (options: Readonly<AddGitattributesOptions>): Promise<MigrationResult> => {
  try {
    const gitattributesPath = new URL('.gitattributes', options.clonedRepoUri).toString()

    // Check if .gitattributes already exists
    const exists = await options.fs.exists(gitattributesPath)
    if (exists) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/add-gitattributes',
      changedFiles: [
        {
          content: GITATTRIBUTES_CONTENT,
          path: '.gitattributes',
        },
      ],
      commitMessage: 'feature: add .gitattributes file',
      pullRequestTitle: 'feature: add .gitattributes file',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: 'ADD_GITATTRIBUTES_FAILED',
      errorMessage: stringifyError(error),
      status: 'error' as const,
    }
    return {
      changedFiles: [],
      errorCode: errorResult.errorCode,
      errorMessage: errorResult.errorMessage,
      status: 'error',
      statusCode: getHttpStatusCode(errorResult),
    }
  }
}
