import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { stringifyJson } from '../StringifyJson/StringifyJson.ts'

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
    const devcontainerContent = stringifyJson({
      customizations: {
        vscode: {
          extensions: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'],
        },
      },
      features: {},
      forwardPorts: [3000],
      image: 'mcr.microsoft.com/devcontainers/javascript-node:24',
      postCreateCommand: 'npm ci',
      postStartCommand: 'npm run dev',
      remoteUser: 'node',
    })

    return {
      branchName: 'feature/add-dev-container-json',
      changedFiles: [
        {
          content: devcontainerContent,
          path: '.devcontainer/devcontainer.json',
        },
      ],
      commitMessage: 'chore: add dev container configuration',
      pullRequestTitle: 'chore: add dev container configuration',
      status: 'success',
      statusCode: 201,
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
