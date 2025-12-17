import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export type AddDevcontainerJsonOptions = BaseMigrationOptions

export const addDevcontainerJson = async (options: Readonly<AddDevcontainerJsonOptions>): Promise<MigrationResult> => {
  try {
    const devcontainerPath = new URL('.devcontainer/devcontainer.json', options.clonedRepoUri).toString()

    // Check if devcontainer.json already exists
    const exists = await options.fs.exists(devcontainerPath)
    if (exists) {
      return emptyMigrationResult
    }

    // Create a devcontainer.json with Node.js 24 configuration
    const devcontainerContent =
      JSON.stringify(
        {
          customizations: {
            vscode: {
              extensions: [],
            },
          },
          features: {},
          image: 'mcr.microsoft.com/devcontainers/javascript-node:1-24',
          name: 'Node.js 24',
        },
        null,
        2,
      ) + '\n'

    return {
      branchName: 'feature/add-devcontainer-json',
      changedFiles: [
        {
          content: devcontainerContent,
          path: '.devcontainer/devcontainer.json',
        },
      ],
      commitMessage: 'chore: add devcontainer.json with Node.js 24',
      pullRequestTitle: 'chore: add devcontainer.json with Node.js 24',
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.ADD_DEVCONTAINER_JSON_FAILED,
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
