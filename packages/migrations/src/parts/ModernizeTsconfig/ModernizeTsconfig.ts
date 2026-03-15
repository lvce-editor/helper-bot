import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type ModernizeTsconfigOptions = BaseMigrationOptions

const TARGET_FILE_PATH = 'packages/e2e/tsconfig.json'

export const modernizeTsconfig = async (options: Readonly<ModernizeTsconfigOptions>): Promise<MigrationResult> => {
  try {
    const targetPath = new URL(TARGET_FILE_PATH, options.clonedRepoUri).toString()
    const exists = await options.fs.exists(targetPath)
    if (!exists) {
      return emptyMigrationResult
    }

    const content = await options.fs.readFile(targetPath, 'utf8')
    const tsconfig = JSON.parse(content)

    if (!tsconfig.compilerOptions || typeof tsconfig.compilerOptions !== 'object') {
      tsconfig.compilerOptions = {}
    }

    const needsModuleResolutionUpdate = tsconfig.compilerOptions.moduleResolution !== 'nodeNext'
    const needsModuleUpdate = tsconfig.compilerOptions.module !== 'nodenext'

    if (!needsModuleResolutionUpdate && !needsModuleUpdate) {
      return emptyMigrationResult
    }

    tsconfig.compilerOptions.moduleResolution = 'nodeNext'
    tsconfig.compilerOptions.module = 'nodenext'

    const updatedContent = JSON.stringify(tsconfig, null, 2) + '\n'

    return {
      branchName: 'feature/modernize-tsconfig',
      changedFiles: [
        {
          content: updatedContent,
          path: TARGET_FILE_PATH,
        },
      ],
      commitMessage: 'ci: modernize e2e tsconfig module settings',
      pullRequestTitle: 'ci: modernize e2e tsconfig module settings',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.MODERNIZE_TSCONFIG_FAILED,
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
