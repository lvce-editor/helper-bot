import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const isStepLine = (trimmed: string): boolean => {
  return trimmed.startsWith('- name:')
}

const isCreateReleaseStep = (trimmed: string): boolean => {
  return isStepLine(trimmed) && trimmed.includes('Create GitHub release')
}

const getIndentedSectionEnd = (lines: readonly string[], startIndex: number, indentation: string): number => {
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed === '') {
      continue
    }
    if (!line.startsWith(indentation)) {
      return i
    }
  }
  return lines.length
}

const findDraftInsertion = (lines: readonly string[]): { hasDraft: boolean; indentation: string; insertIndex: number } | undefined => {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!isCreateReleaseStep(trimmed)) {
      continue
    }

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]
      const currentTrimmed = line.trim()

      if (isStepLine(currentTrimmed) || (currentTrimmed.startsWith('jobs:') && j > 20)) {
        return undefined
      }

      if (!currentTrimmed.startsWith('with:')) {
        continue
      }

      const indentation = line.slice(0, line.indexOf('with:'))
      const sectionIndentation = `${indentation}  `
      const endIndex = getIndentedSectionEnd(lines, j + 1, sectionIndentation)
      const withLines = lines.slice(j + 1, endIndex)
      if (withLines.some((entry) => entry.trim().startsWith('draft:'))) {
        return { hasDraft: true, indentation, insertIndex: -1 }
      }
      return {
        hasDraft: false,
        indentation,
        insertIndex: endIndex,
      }
    }
  }
  return undefined
}

const findLastJobStep = (lines: readonly string[]): { lastStepIndex: number; stepsIndentation: string } | undefined => {
  let lastJobIndex = -1
  let stepsIndentation = ''
  let lastStepIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (/^[a-z-]+:$/.test(trimmed) && i > 0) {
      const prevLine = lines[i - 1].trim()
      if (prevLine === '' || prevLine === 'jobs:') {
        lastJobIndex = i
      }
    }
    if (lastJobIndex > 0 && i > lastJobIndex && trimmed === 'steps:') {
      stepsIndentation = line.slice(0, line.indexOf('steps:'))
    }
    if (stepsIndentation && line.startsWith(`${stepsIndentation}  - `)) {
      lastStepIndex = i
    }
  }

  if (lastStepIndex === -1) {
    return undefined
  }
  return { lastStepIndex, stepsIndentation }
}

const addDraftToCreateRelease = (content: Readonly<string>): string => {
  const lines = content.split('\n')
  const insertion = findDraftInsertion(lines)
  if (!insertion) {
    return content
  }
  if (insertion.hasDraft) {
    return content
  }

  const draftLine = `${insertion.indentation}  draft: true`
  lines.splice(insertion.insertIndex, 0, draftLine)

  const result = lines.join('\n')
  return result.endsWith('\n') ? result : result + '\n'
}

const addPublishReleaseStep = (content: Readonly<string>): string => {
  const lines = content.split('\n')
  if (content.includes('Publish GitHub release')) {
    return content
  }

  const lastJobStep = findLastJobStep(lines)
  if (!lastJobStep) {
    return content
  }

  const stepIndentation = `${lastJobStep.stepsIndentation}  `
  const endOfLastStep = getIndentedSectionEnd(lines, lastJobStep.lastStepIndex + 1, stepIndentation)
  const publishStep = [
    `${stepIndentation}- name: Publish GitHub release`,
    `${stepIndentation}  env:`,
    `${stepIndentation}    GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`,
    `${stepIndentation}  run: |`,
    `${stepIndentation}    VERSION="\${{ needs.create-release.outputs.rg_version }}"`,
    `${stepIndentation}    gh release edit $VERSION --draft=false`,
  ]
  lines.splice(endOfLastStep, 0, ...publishStep)

  const result = lines.join('\n')
  return result.endsWith('\n') ? result : result + '\n'
}

const createPrereleaseBeforeReleaseContent = (content: Readonly<string>): string => {
  let updatedContent = addDraftToCreateRelease(content)
  updatedContent = addPublishReleaseStep(updatedContent)
  return updatedContent
}

export type CreatePrereleaseBeforeReleaseOptions = BaseMigrationOptions

export const createPrereleaseBeforeRelease = async (options: Readonly<CreatePrereleaseBeforeReleaseOptions>): Promise<MigrationResult> => {
  try {
    const workflowPath = new URL('.github/workflows/release.yml', options.clonedRepoUri).toString()

    const fileExists = await options.fs.exists(workflowPath)
    if (!fileExists) {
      return emptyMigrationResult
    }

    const originalContent = await options.fs.readFile(workflowPath, 'utf8')
    const updatedContent = createPrereleaseBeforeReleaseContent(originalContent)
    const hasChanges = originalContent !== updatedContent
    const pullRequestTitle = 'feature: create prerelease before final release'

    if (!hasChanges) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/create-prerelease-before-release',
      changedFiles: [
        {
          content: updatedContent,
          path: '.github/workflows/release.yml',
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.CREATE_PRERELEASE_BEFORE_RELEASE_FAILED,
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
