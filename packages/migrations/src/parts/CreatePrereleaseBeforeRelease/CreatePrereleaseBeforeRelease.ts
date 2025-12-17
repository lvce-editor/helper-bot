import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const addDraftToCreateRelease = (content: Readonly<string>): string => {
  const lines = content.split('\n')
  let insideCreateReleaseStep = false
  let insideWithSection = false
  let withIndentation = ''
  let insertIndex = -1

  // Find the Create GitHub release step and check if draft is already present
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check if we're entering the Create GitHub release step
    if (trimmed.startsWith('- name:') && trimmed.includes('Create GitHub release')) {
      insideCreateReleaseStep = true
      continue
    }

    if (insideCreateReleaseStep) {
      // Check if we're entering the with section
      if (trimmed.startsWith('with:')) {
        insideWithSection = true
        withIndentation = line.slice(0, line.indexOf('with:'))
        continue
      }

      // If we're in the with section
      if (insideWithSection) {
        // Check if draft is already present
        if (trimmed.startsWith('draft:')) {
          return content // Already has draft
        }

        // Check if we've reached the end of the with section (next line is less indented or a new step)
        if (trimmed !== '' && !line.startsWith(withIndentation + '  ')) {
          // This is the end of the with section
          insertIndex = i
          break
        }

        // If this is the last non-empty line in with section, mark the next position
        if (i + 1 >= lines.length || !lines[i + 1].startsWith(withIndentation + '  ')) {
          insertIndex = i + 1
          break
        }
      }

      // Check if we've left the create-release step entirely
      if (trimmed.startsWith('- name:') || (trimmed.startsWith('jobs:') && i > 20)) {
        break
      }
    }
  }

  // If we found where to insert, add draft: true
  if (insertIndex > 0) {
    const draftLine = `${withIndentation}  draft: true`
    lines.splice(insertIndex, 0, draftLine)
  }

  return lines.join('\n')
}

const addPublishReleaseStep = (content: Readonly<string>): string => {
  const lines = content.split('\n')
  let lastJobIndex = -1
  let stepsIndentation = ''
  let lastStepIndex = -1

  // Find the last job and its last step
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Find jobs section
    if (/^[a-z-]+:$/.test(trimmed) && i > 0) {
      const prevLine = lines[i - 1].trim()
      // This is likely a job definition if previous line is empty or it's under jobs:
      if (prevLine === '' || prevLine === 'jobs:') {
        lastJobIndex = i
      }
    }

    // If we're in a job, find the steps section
    if (lastJobIndex > 0 && i > lastJobIndex) {
      if (trimmed === 'steps:') {
        stepsIndentation = line.slice(0, line.indexOf('steps:'))
      }

      // Find the last step (lines starting with "- " under steps)
      if (stepsIndentation && line.startsWith(stepsIndentation + '  - ')) {
        lastStepIndex = i
      }
    }
  }

  // Check if publish release step already exists
  if (content.includes('Publish GitHub release')) {
    return content
  }

  // Add the publish release step at the end of the last job
  if (lastStepIndex > 0) {
    // Find the end of the last step
    let endOfLastStep = lastStepIndex + 1
    const stepIndentation = stepsIndentation + '  '

    while (endOfLastStep < lines.length) {
      const line = lines[endOfLastStep]
      if (line.trim() === '') {
        endOfLastStep++
        continue
      }
      // If line doesn't start with step indentation or greater, we've reached the end
      if (!line.startsWith(stepIndentation)) {
        break
      }
      endOfLastStep++
    }

    const publishStep = [
      `${stepIndentation}- name: Publish GitHub release`,
      `${stepIndentation}  env:`,
      `${stepIndentation}    GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`,
      `${stepIndentation}  run: |`,
      `${stepIndentation}    VERSION="\${{ needs.create-release.outputs.rg_version }}"`,
      `${stepIndentation}    gh release edit $VERSION --draft=false`,
    ]

    lines.splice(endOfLastStep, 0, ...publishStep)
  }

  return lines.join('\n')
}

const createPrereleaseBeforeReleaseContent = (content: Readonly<string>): string => {
  // First add draft: true to the create release step
  let updatedContent = addDraftToCreateRelease(content)

  // Then add the publish release step at the end
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
      statusCode: 200,
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
