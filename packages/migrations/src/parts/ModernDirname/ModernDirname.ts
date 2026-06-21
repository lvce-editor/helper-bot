import type * as FsPromises from 'node:fs/promises'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'
import { resolveUri } from '../UriUtils/UriUtils.ts'

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
    const entryPath = resolveUri(entry.name, dirUri + '/')
    if (entry.isDirectory()) {
      // Skip node_modules and .Git directories
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

const removeNamedImport = (content: string, moduleName: string, importName: string): string => {
  const lines = content.split('\n')
  const newLines = lines.map((line) => {
    if (!line.includes(`from '${moduleName}'`) && !line.includes(`from "${moduleName}"`)) {
      return line
    }
    const braceStart = line.indexOf('{')
    const braceEnd = line.indexOf('}', braceStart)
    if (braceStart === -1 || braceEnd === -1) {
      return line
    }
    const importList = line
      .slice(braceStart + 1, braceEnd)
      .split(',')
      .map((importItem) => importItem.trim())
      .filter(Boolean)
    const filtered = importList.filter((importItem) => importItem !== importName)
    if (filtered.length === importList.length) {
      return line
    }
    if (filtered.length === 0) {
      return ''
    }
    return `${line.slice(0, braceStart + 1)} ${filtered.join(', ')} ${line.slice(braceEnd)}`
  })
  return newLines.join('\n')
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
    newContent = removeNamedImport(newContent, 'node:url', 'fileURLToPath')
  }

  // Remove dirname from imports if not used elsewhere
  if (!dirnameUsedElsewhere) {
    newContent = removeNamedImport(newContent, 'node:path', 'dirname')
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
      statusCode: 201,
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
