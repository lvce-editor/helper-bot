import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const collectFiles = async (
  fs: Readonly<typeof FsPromises & { exists: (path: string | Buffer | URL) => Promise<boolean> }>,
  dirUri: string,
  fileList: string[] = [],
): Promise<string[]> => {
  let entries: any[]
  try {
    entries = await fs.readdir(dirUri, {
      withFileTypes: true,
    })
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return fileList
    }
    throw error
  }

  for (const entry of entries) {
    const entryPath = new URL(entry.name, dirUri + '/').toString()
    if (entry.isDirectory()) {
      // Skip node_modules and .git directories
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue
      }
      await collectFiles(fs, entryPath, fileList)
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
        fileList.push(entryPath)
      }
  }

  return fileList
}

const processFile = (content: string): { newContent: string; changed: boolean } => {
  // Pattern to match: const __dirname = dirname(fileURLToPath(import.meta.url))
  const dirnamePattern = /const\s+__dirname\s*=\s*dirname\s*\(\s*fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*\)/g

  // Check if pattern exists (reset regex after test)
  const hasPattern = dirnamePattern.test(content)
  dirnamePattern.lastIndex = 0

  if (!hasPattern) {
    return { changed: false, newContent: content }
  }

  let newContent = content

  // Replace the pattern
  newContent = newContent.replaceAll(
    /const\s+__dirname\s*=\s*dirname\s*\(\s*fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*\)/g,
    'const __dirname = import.meta.dirname',
  )

  // Check if fileURLToPath is used elsewhere in the file
  const fileURLToPathUsage = newContent.match(/fileURLToPath/g)
  const fileURLToPathUsedElsewhere = fileURLToPathUsage && fileURLToPathUsage.length > 0

  // Check if dirname is used elsewhere in the file
  const dirnameUsage = newContent.match(/\bdirname\s*\(/g)
  const dirnameUsedElsewhere = dirnameUsage && dirnameUsage.length > 0

  // Remove unused imports
  // Remove fileURLToPath from imports if not used elsewhere
  if (!fileURLToPathUsedElsewhere) {
    // Match import statements that include fileURLToPath
    // Handle: import { fileURLToPath } from 'node:url'
    // Handle: import { fileURLToPath, other } from 'node:url'
    // Handle: import { other, fileURLToPath } from 'node:url'
    // Handle: import { other, fileURLToPath, other2 } from 'node:url'
    newContent = newContent.replaceAll(/import\s*{\s*([^}]*)\s*}\s*from\s*['"]node:url['"]/g, (match, imports) => {
      const importList = imports.split(',').map((imp: string) => imp.trim())
      const filtered = importList.filter((imp: string) => imp !== 'fileURLToPath')
      if (filtered.length === 0) {
        return '' // Remove entire import if nothing left
      }
      return `import { ${filtered.join(', ')} } from 'node:url'`
    })
  }

  // Remove dirname from imports if not used elsewhere
  if (!dirnameUsedElsewhere) {
    // Match import statements that include dirname
    // Handle: import { dirname } from 'node:path'
    // Handle: import { dirname, other } from 'node:path'
    // Handle: import { other, dirname } from 'node:path'
    // Handle: import { other, dirname, other2 } from 'node:path'
    newContent = newContent.replaceAll(/import\s*{\s*([^}]*)\s*}\s*from\s*['"]node:path['"]/g, (match, imports) => {
      const importList = imports.split(',').map((imp: string) => imp.trim())
      const filtered = importList.filter((imp: string) => imp !== 'dirname')
      if (filtered.length === 0) {
        return '' // Remove entire import if nothing left
      }
      return `import { ${filtered.join(', ')} } from 'node:path'`
    })
  }

  // Clean up empty lines that might result from removed imports
  newContent = newContent.replaceAll(/\n\n\n+/g, '\n\n')

  return { changed: true, newContent }
}

export type ModernDirnameOptions = BaseMigrationOptions

export const modernDirname = async (options: Readonly<ModernDirnameOptions>): Promise<MigrationResult> => {
  try {
    const allFiles = await collectFiles(options.fs, options.clonedRepoUri)
    const changedFiles: Array<{ path: string; content: string }> = []

    for (const fileUri of allFiles) {
      try {
        const content = await options.fs.readFile(fileUri, 'utf8')
        const { changed, newContent } = processFile(content)

        if (changed) {
          // Get relative path from clonedRepoUri
          const repoUrl = new URL(options.clonedRepoUri)
          const fileUrl = new URL(fileUri)
          const relativePath = fileUrl.pathname.replace(repoUrl.pathname, '').replace(/^\//, '')

          changedFiles.push({
            content: newContent,
            path: relativePath,
          })
        }
      } catch (error: any) {
        if (error && error.code === 'ENOENT') {
          continue
        }
        throw error
      }
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/modern-dirname',
      changedFiles,
      commitMessage: 'chore: modernize __dirname to use import.meta.dirname',
      pullRequestTitle: 'chore: modernize __dirname to use import.meta.dirname',
      status: 'success',
      statusCode: 200,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.MODERN_DIRNAME_FAILED,
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
