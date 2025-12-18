import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const defaultEslintConfig = `import * as config from '@lvce-editor/eslint-config'
import * as actions from '@lvce-editor/eslint-plugin-github-actions'

export default [...config.default, ...actions.default]
`

export type AddEslintConfigOptions = BaseMigrationOptions

export const addEslintConfig = async (options: Readonly<AddEslintConfigOptions>): Promise<MigrationResult> => {
  try {
    const eslintConfigPath = new URL('eslint.config.js', options.clonedRepoUri).toString()

    // Check if eslint.config.js already exists
    const exists = await options.fs.exists(eslintConfigPath)
    if (exists) {
      return emptyMigrationResult
    }

    const pullRequestTitle = 'feature: add eslint.config.js'

    return {
      branchName: 'feature/add-eslint-config',
      changedFiles: [
        {
          content: defaultEslintConfig,
          path: 'eslint.config.js',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.ADD_ESLINT_CONFIG_FAILED,
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
