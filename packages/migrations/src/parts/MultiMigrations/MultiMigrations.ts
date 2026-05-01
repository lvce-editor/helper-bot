import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export interface MultiMigrationsUpdateNodeVersionOptions extends BaseMigrationOptions {
  readonly baseBranch?: string
  readonly migrationName: string
  readonly migrationOptions?: Record<string, any>
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

const validateRepositoryNames = (repositoryNames: readonly string[]): string | undefined => {
  if (!repositoryNames || repositoryNames.length === 0) {
    return 'repositoryNames is required and must be a non-empty array'
  }

  for (const repo of repositoryNames) {
    if (typeof repo !== 'string' || !repo.includes('/')) {
      return `Invalid repository name format: ${repo}. Expected format: owner/repo`
    }
  }

  return undefined
}

const parseResponseData = (responseText: string): any => {
  try {
    return JSON.parse(responseText)
  } catch {
    return responseText
  }
}

const getSuccessMessage = (responseData: any): string => {
  return typeof responseData === 'string' ? responseData : responseData.message || 'Success'
}

const getErrorMessage = (responseData: any, status: number): string => {
  if (typeof responseData === 'string') {
    return responseData
  }
  return responseData.error || responseData.details || `HTTP ${status}`
}

const runMigrationRequest = async (
  fetchFn: typeof globalThis.fetch,
  baseUrl: string,
  endpointSecret: string,
  migrationName: string,
  migrationOptions: Record<string, any> | undefined,
  repository: string,
): Promise<RepositoryResult> => {
  const url = new URL(`/my-app/migrations2/${migrationName}`, baseUrl)
  const response = await fetchFn(url.toString(), {
    body: JSON.stringify({
      repository,
      ...migrationOptions,
    }),
    headers: {
      Authorization: `Bearer ${endpointSecret}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  const responseData = parseResponseData(await response.text())
  if (response.ok) {
    return {
      message: getSuccessMessage(responseData),
      repository,
      success: true,
    }
  }

  return {
    error: getErrorMessage(responseData, response.status),
    repository,
    success: false,
  }
}

export const multiMigrations = async (options: Readonly<MultiMigrationsUpdateNodeVersionOptions>): Promise<MigrationResult> => {
  try {
    const { fetch: fetchFn, migrationOptions, repositoryNames } = options

    const validationError = validateRepositoryNames(repositoryNames)
    if (validationError) {
      return {
        changedFiles: [],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        errorMessage: validationError,
        status: 'error',
        statusCode: 400,
      }
    }

    const baseUrl = options.serverUrl || process.env.SERVER_URL || 'http://localhost:3000'
    const endpointSecret = options.secret || process.env.DEPENDENCIES_SECRET

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

    for (const repository of repositoryNames) {
      try {
        results.push(await runMigrationRequest(fetchFn, baseUrl, endpointSecret, options.migrationName, migrationOptions, repository))
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
      errorCode: ERROR_CODES.MULTI_MIGRATION_FAILED,
      errorMessage: stringifyError(error),
      status: 'error',
      statusCode: getHttpStatusCode({
        errorCode: ERROR_CODES.MULTI_MIGRATION_FAILED,
        errorMessage: stringifyError(error),
        status: 'error',
      }),
    }
  }
}
