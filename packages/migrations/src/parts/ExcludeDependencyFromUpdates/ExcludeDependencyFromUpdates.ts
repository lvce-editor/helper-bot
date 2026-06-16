import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { createValidationErrorMigrationResult, emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

export interface ExcludeDependencyFromUpdatesOptions extends BaseMigrationOptions {
  dependencyName: string
}

const ncuCommandRegex = /OUTPUT=`ncu -u(?<args>.*?)`/g
const excludedDependencyRegex = /(?:^|\s)-x\s+(?<dependency>[^\s]+)/g

const getExcludedDependencies = (ncuArgs: string): readonly string[] => {
  return [...ncuArgs.matchAll(excludedDependencyRegex)].flatMap((match) => {
    const dependency = match.groups?.dependency
    return dependency ? [dependency] : []
  })
}

const addDependencyExclusion = (ncuArgs: string, dependencyName: string): string => {
  if (ncuArgs.trim() === '') {
    return ` -x ${dependencyName}`
  }
  return `${ncuArgs} -x ${dependencyName}`
}

const computeExcludeDependencyFromUpdatesContent = (
  currentContent: string,
  dependencyName: string,
): {
  readonly hasChanges: boolean
  readonly newContent: string
} => {
  const matches = [...currentContent.matchAll(ncuCommandRegex)]
  if (matches.length === 0) {
    return {
      hasChanges: false,
      newContent: currentContent,
    }
  }

  let hasChanges = false
  let newContent = currentContent

  for (const match of matches) {
    const ncuArgs = match.groups?.args || ''
    const excludedDependencies = getExcludedDependencies(ncuArgs)
    if (excludedDependencies.includes(dependencyName)) {
      continue
    }
    const updatedArgs = addDependencyExclusion(ncuArgs, dependencyName)
    newContent = newContent.replace(match[0], `OUTPUT=\`ncu -u${updatedArgs}\``)
    hasChanges = true
  }

  return {
    hasChanges,
    newContent,
  }
}

const toBranchSegment = (dependencyName: string): string => {
  const normalizedDependencyName = dependencyName.startsWith('@') ? dependencyName.slice(1) : dependencyName
  return normalizedDependencyName.replaceAll(/[^a-zA-Z0-9]+/g, '-').replaceAll(/^-|-$/g, '')
}

export const excludeDependencyFromUpdates = async (options: Readonly<ExcludeDependencyFromUpdatesOptions>): Promise<MigrationResult> => {
  try {
    if (!options.dependencyName || typeof options.dependencyName !== 'string' || options.dependencyName.trim() === '') {
      return createValidationErrorMigrationResult('Invalid or missing dependencyName parameter')
    }

    const dependencyName = options.dependencyName.trim()
    const scriptPath = new URL('scripts/update-dependencies.sh', options.clonedRepoUri).toString()

    let currentContent: string
    try {
      currentContent = await options.fs.readFile(scriptPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    const result = computeExcludeDependencyFromUpdatesContent(currentContent, dependencyName)
    if (!result.hasChanges) {
      return emptyMigrationResult
    }

    const branchSegment = toBranchSegment(dependencyName)
    const pullRequestTitle = `ci: exclude ${dependencyName} from dependency updates`

    return {
      branchName: `feature/exclude-${branchSegment}-from-updates`,
      changedFiles: [
        {
          content: result.newContent,
          path: 'scripts/update-dependencies.sh',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.EXCLUDE_DEPENDENCY_FROM_UPDATES_FAILED,
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
