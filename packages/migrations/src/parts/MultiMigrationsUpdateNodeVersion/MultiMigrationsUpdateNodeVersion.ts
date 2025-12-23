import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export interface MultiMigrationsUpdateNodeVersionOptions extends BaseMigrationOptions {
  readonly baseBranch?: string
  readonly repositoryNames: readonly string[]
  readonly secret?: string
  readonly serverUrl?: string
}

export interface RepositoryResult {
  readonly error?: string
  readonly message?: string
  readonly repository: string
  readonly success: boolean
}

export interface MultiMigrationsUpdateNodeVersionData {
  readonly failed: number
  readonly results: readonly RepositoryResult[]
  readonly successful: number
  readonly total: number
}

export const multiMigrationsUpdateNodeVersion = async (options: Readonly<MultiMigrationsUpdateNodeVersionOptions>): Promise<MigrationResult> => {
  try {
    const { baseBranch, fetch: fetchFn, repositoryNames } = options

    if (!repositoryNames || repositoryNames.length === 0) {
      return {
        changedFiles: [],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        errorMessage: 'repositoryNames is required and must be a non-empty array',
        status: 'error',
        statusCode: 400,
      }
    }

    // Validate repository names format
    for (const repo of repositoryNames) {
      if (typeof repo !== 'string' || !repo.includes('/')) {
        return {
          changedFiles: [],
          errorCode: ERROR_CODES.VALIDATION_ERROR,
          errorMessage: `Invalid repository name format: ${repo}. Expected format: owner/repo`,
          status: 'error',
          statusCode: 400,
        }
      }
    }

    // Get server URL from options or environment variable
    const baseUrl = process.env.SERVER_URL || 'http://localhost:3000'
    const endpointSecret = process.env.DEPENDENCIES_SECRET

    if (!endpointSecret) {
      return {
        changedFiles: [],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        errorMessage: 'secret is required (either passed as parameter or set as DEPENDENCIES_SECRET environment variable)',
        status: 'error',
        statusCode: 400,
      }
    }

    const results: RepositoryResult[] = []

    // Process repositories one after another (sequentially)
    for (const repository of repositoryNames) {
      try {
        const url = new URL('/my-app/migrations/update-node-version', baseUrl)
        url.searchParams.set('repository', repository)
        url.searchParams.set('secret', endpointSecret)
        if (baseBranch) {
          url.searchParams.set('baseBranch', baseBranch)
        }

        const response = await fetchFn(url.toString(), {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })

        const responseText = await response.text()
        let responseData: any
        try {
          responseData = JSON.parse(responseText)
        } catch {
          responseData = responseText
        }

        if (response.ok) {
          results.push({
            message: typeof responseData === 'string' ? responseData : responseData.message || 'Success',
            repository,
            success: true,
          })
        } else {
          results.push({
            error: typeof responseData === 'string' ? responseData : responseData.error || responseData.details || `HTTP ${response.status}`,
            repository,
            success: false,
          })
        }
      } catch (error) {
        results.push({
          error: stringifyError(error),
          repository,
          success: false,
        })
      }
    }

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    const data: MultiMigrationsUpdateNodeVersionData = {
      failed,
      results,
      successful,
      total: repositoryNames.length,
    }

    return {
      ...emptyMigrationResult,
      data,
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    return {
      changedFiles: [],
      errorCode: ERROR_CODES.UPDATE_NODE_VERSION_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
      statusCode: getHttpStatusCode({
        errorCode: ERROR_CODES.UPDATE_NODE_VERSION_FAILED,
        errorMessage: stringifyError(error),
        status: 'error',
      }),
    }
  }
}
