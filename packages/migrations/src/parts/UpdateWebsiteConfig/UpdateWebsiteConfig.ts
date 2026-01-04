import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { getLatestRelease } from '../GetLatestRelease/GetLatestRelease.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

const CONFIG_PATH = 'packages/website/config.json'
const EXPECTED_REPO_NAME = 'lvce-editor.github.io'
const TARGET_REPO_OWNER = 'lvce-editor'
const TARGET_REPO_NAME = 'lvce-editor'

interface WebsiteConfig {
  readonly currentYear: number
  readonly releaseUrlBase: string
  readonly version: string
}

export interface UpdateWebsiteConfigOptions extends BaseMigrationOptions {
  readonly githubToken: string
  readonly OctokitConstructor?: typeof OctokitConstructor
}

export const updateWebsiteConfig = async (options: Readonly<UpdateWebsiteConfigOptions>): Promise<MigrationResult> => {
  try {
    // Verify repository name
    if (options.repositoryName !== EXPECTED_REPO_NAME) {
      return {
        changedFiles: [],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        errorMessage: `This migration can only be run on repository "${EXPECTED_REPO_NAME}", but got "${options.repositoryName}"`,
        status: 'error',
        statusCode: 400,
      }
    }

    // Ensure clonedRepoUri ends with / for proper URL resolution
    const baseUri = options.clonedRepoUri.endsWith('/') ? options.clonedRepoUri : options.clonedRepoUri + '/'
    const configPath = new URL(CONFIG_PATH, baseUri).toString()

    // Check if config file exists
    const configExists = await options.fs.exists(configPath)
    if (!configExists) {
      return {
        changedFiles: [],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        errorMessage: `Config file not found at ${CONFIG_PATH}`,
        status: 'error',
        statusCode: 400,
      }
    }

    // Read the config file
    const configContent = await options.fs.readFile(configPath, 'utf8')
    const config: WebsiteConfig = JSON.parse(configContent)

    // Create Octokit instance
    const { githubToken, OctokitConstructor: OctokitCtor = OctokitConstructor } = options
    const octokit: Octokit = new OctokitCtor({
      auth: githubToken,
    })

    // Get the latest release from lvce-editor/lvce-editor
    const latestRelease = await getLatestRelease(octokit, TARGET_REPO_OWNER, TARGET_REPO_NAME)
    if (!latestRelease) {
      return {
        changedFiles: [],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        errorMessage: `No releases or tags found for ${TARGET_REPO_OWNER}/${TARGET_REPO_NAME}`,
        status: 'error',
        statusCode: 400,
      }
    }

    const latestVersion = latestRelease.tag_name
    const currentYear = new Date().getFullYear()

    // Check if updates are needed
    const needsVersionUpdate = config.version !== latestVersion
    const needsYearUpdate = config.currentYear !== currentYear

    if (!needsVersionUpdate && !needsYearUpdate) {
      return emptyMigrationResult
    }

    // Update the config
    const updatedConfig: WebsiteConfig = {
      ...config,
      currentYear,
      version: latestVersion,
    }

    // Write the updated config
    const updatedContent = JSON.stringify(updatedConfig, null, 2) + '\n'
    const relativePath = normalizePath(CONFIG_PATH)

    return {
      branchName: 'feature/update-website-config',
      changedFiles: [
        {
          content: updatedContent,
          path: relativePath,
        },
      ],
      commitMessage: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
      pullRequestTitle: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.VALIDATION_ERROR,
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

