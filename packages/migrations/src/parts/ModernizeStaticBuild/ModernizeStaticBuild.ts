import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const processFile = (content: string): { newContent: string; changed: boolean } => {
  // Check if it's already been updated
  if (content.includes('exportStatic({root:')) {
    return { changed: false, newContent: content }
  }

  // Check if the script contains the old pattern
  // Pattern: import { exportStatic } from '@lvce-editor/shared-process' and await exportStatic()
  const hasExportStaticImport = /import\s+{\s*exportStatic\s*}\s+from\s+['"]@lvce-editor\/shared-process['"]/.test(content)
  const hasOldExportStaticCall = /await\s+exportStatic\(\)/.test(content)

  if (!hasExportStaticImport || !hasOldExportStaticCall) {
    return { changed: false, newContent: content }
  }

  // Update the content
  let newContent = content

  // First, ensure join is imported from node:path
  const hasJoinImport = /import\s+.*join.*\s+from\s+['"]node:path['"]/.test(newContent)
  if (!hasJoinImport) {
    // Add import after the exportStatic import
    newContent = newContent.replace(/(import\s+{\s*exportStatic\s*}\s+from\s+['"]@lvce-editor\/shared-process['"])/, "$1\nimport { join } from 'node:path'")
  }

  // Update the await exportStatic() call
  newContent = newContent.replace(/await\s+exportStatic\(\)/, "await exportStatic({root: join(import.meta.dirname, '..')})")

  if (newContent === content) {
    return { changed: false, newContent: content }
  }

  return { changed: true, newContent }
}

export type ModernizeStaticBuildOptions = BaseMigrationOptions

export const modernizeStaticBuild = async (options: Readonly<ModernizeStaticBuildOptions>): Promise<MigrationResult> => {
  try {
    const buildStaticPath = new URL('scripts/build-static.js', options.clonedRepoUri).toString()

    // Check if build-static.js exists
    const exists = await options.fs.exists(buildStaticPath)
    if (!exists) {
      return emptyMigrationResult
    }

    const content = await options.fs.readFile(buildStaticPath, 'utf8')
    const { changed, newContent } = processFile(content)

    if (!changed) {
      return emptyMigrationResult
    }

    // Get relative path from clonedRepoUri
    const repoUrl = new URL(options.clonedRepoUri)
    const fileUrl = new URL(buildStaticPath)
    const relativePath = fileUrl.pathname.replace(repoUrl.pathname, '').replace(/^\//, '')

    return {
      branchName: 'feature/modernize-static-build',
      changedFiles: [
        {
          content: newContent,
          path: relativePath,
        },
      ],
      commitMessage: 'ci: modernize exportStatic call to pass root argument',
      pullRequestTitle: 'ci: modernize exportStatic call to pass root argument',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.MODERNIZE_STATIC_BUILD_FAILED,
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
