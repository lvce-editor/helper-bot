import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const WORKFLOW_FILES = ['pr.yml', 'ci.yml', 'release.yml'] as const

const hasLintStep = (content: string): boolean => {
  return content.includes('npm run lint')
}

const addLintStepToWorkflowContent = (content: string): { content: string; error?: string } => {
  if (hasLintStep(content)) {
    return { content }
  }

  const lines = content.split('\n')

  // Find possible insertion points
  const typeCheckIndex = lines.findIndex((line) => line.includes('npm run type-check'))
  const testIndex = lines.findIndex((line) => line.includes('npm test'))
  const buildIndex = lines.findIndex((line) => line.includes('npm run build'))

  let insertIndex = -1
  if (typeCheckIndex !== -1) {
    insertIndex = typeCheckIndex
  } else if (testIndex !== -1) {
    insertIndex = testIndex
  } else if (buildIndex !== -1) {
    insertIndex = buildIndex
  }

  if (insertIndex === -1) {
    return {
      content,
      error: 'No suitable location found to add lint step. Expected to find one of: npm run type-check, npm test, or npm run build',
    }
  }

  // Get the indentation of the reference line
  const referenceLine = lines[insertIndex]
  const indentation = referenceLine.match(/^(\s*)/)?.[1] || ''

  // Insert the lint step after the reference line
  const newLines = [...lines.slice(0, insertIndex + 1), `${indentation}- run: npm run lint`, ...lines.slice(insertIndex + 1)]

  return { content: newLines.join('\n') }
}

export type RunLintInCiOptions = BaseMigrationOptions

export const runLintInCi = async (options: Readonly<RunLintInCiOptions>): Promise<MigrationResult> => {
  try {
    const changedFiles: Array<{ content: string; path: string }> = []
    const errors: string[] = []

    for (const workflowFile of WORKFLOW_FILES) {
      const workflowPath = new URL(`.github/workflows/${workflowFile}`, options.clonedRepoUri).toString()

      const fileExists = await options.fs.exists(workflowPath)
      if (!fileExists) {
        continue
      }

      const originalContent = await options.fs.readFile(workflowPath, 'utf8')
      const { content: updatedContent, error } = addLintStepToWorkflowContent(originalContent)

      if (error) {
        errors.push(`${workflowFile}: ${error}`)
        continue
      }

      const hasChanges = originalContent !== updatedContent
      if (hasChanges) {
        changedFiles.push({
          content: updatedContent,
          path: `.github/workflows/${workflowFile}`,
        })
      }
    }

    if (errors.length > 0) {
      return {
        changedFiles: [],
        errorCode: ERROR_CODES.RUN_LINT_IN_CI_FAILED,
        errorMessage: errors.join('; '),
        status: 'error',
        statusCode: getHttpStatusCode({
          errorCode: ERROR_CODES.RUN_LINT_IN_CI_FAILED,
          errorMessage: errors.join('; '),
          status: 'error' as const,
        }),
      }
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    return {
      branchName: 'ci/add-lint-step',
      changedFiles,
      commitMessage: 'ci: add lint step to workflows',
      pullRequestTitle: 'ci: add lint step to workflows',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.RUN_LINT_IN_CI_FAILED,
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
