import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const hasContributingSection = (content: string): boolean => {
  return /^#{1,6}\s+contributing\b/im.test(content)
}

const getContributingSection = (repositoryOwner: string, repositoryName: string): string => {
  return `## Contributing\n\n\`\`\`sh\ngit clone git@github.com:${repositoryOwner}/${repositoryName}.git &&\ncd ${repositoryName} &&\nnpm ci &&\nnpm test\n\`\`\``
}

const appendContributingSection = (content: string, section: string): string => {
  const trimmedContent = content.trimEnd()
  if (!trimmedContent) {
    return `${section}\n`
  }
  return `${trimmedContent}\n\n${section}\n`
}

export type AddContributingSectionToReadmeOptions = BaseMigrationOptions

export const addContributingSectionToReadme = async (
  options: Readonly<AddContributingSectionToReadmeOptions>,
): Promise<MigrationResult> => {
  try {
    const readmePath = 'README.md'
    const fullPath = new URL(readmePath, options.clonedRepoUri).toString()

    let originalContent = ''
    try {
      originalContent = await options.fs.readFile(fullPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return emptyMigrationResult
      }
      throw error
    }

    if (hasContributingSection(originalContent)) {
      return emptyMigrationResult
    }

    const contributingSection = getContributingSection(options.repositoryOwner, options.repositoryName)
    const updatedContent = appendContributingSection(originalContent, contributingSection)

    const pullRequestTitle = 'feature: add contributing section to README'

    return {
      branchName: 'feature/add-contributing-section-to-readme',
      changedFiles: [
        {
          content: updatedContent,
          path: readmePath,
        },
      ],
      commitMessage: pullRequestTitle,
      pullRequestTitle,
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.UPDATE_DEPENDENCIES_FAILED,
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
