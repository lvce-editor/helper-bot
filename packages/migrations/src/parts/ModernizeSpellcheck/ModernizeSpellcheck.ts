import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const processFile = (content: string): { newContent: string; changed: boolean } => {
  // Check if cspell is already disabled
  if (content.includes("'@cspell/spellchecker': 'off'") || content.includes('"@cspell/spellchecker": "off"')) {
    return { changed: false, newContent: content }
  }

  // Check if there's an export default array
  const exportDefaultMatch = content.match(/export\s+default\s+(\[[\s\S]*\])/)
  if (!exportDefaultMatch) {
    return { changed: false, newContent: content }
  }

  let newContent = content

  // Check if there's already a rules object in the array
  // We need to find the last rules object in the export default array
  const arrayContent = exportDefaultMatch[1]
  const rulesObjectMatch = arrayContent.match(/{[\s\S]*?rules:\s*{([^}]*)}[\s\S]*?}/)

  if (rulesObjectMatch) {
    // There's already a rules object, we need to add our rule to it
    const rulesContent = rulesObjectMatch[1]
    const fullRulesObject = rulesObjectMatch[0]

    // Detect the formatting style (inline or multiline)
    const isMultiline = rulesContent.includes('\n')

    if (isMultiline) {
      // Preserve multiline formatting
      // Find the last line with content before the closing brace
      const lines = rulesContent.split('\n')
      let lastContentLineIndex = -1
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().length > 0) {
          lastContentLineIndex = i
          break
        }
      }

      if (lastContentLineIndex === -1) {
        return { changed: false, newContent: content }
      }

      // Detect indentation from the last rule line
      const lastContentLine = lines[lastContentLineIndex]
      const match = lastContentLine.match(/^(\s+)/)
      const indent = match ? match[1] : '      '

      // Add comma to the last line if it doesn't have one
      if (!lastContentLine.trimEnd().endsWith(',')) {
        lines[lastContentLineIndex] = lastContentLine + ','
      }

      // Add the new rule
      lines.splice(lastContentLineIndex + 1, 0, indent + "'@cspell/spellchecker': 'off'")

      const newRulesContent = lines.join('\n')
      const newRulesObject = fullRulesObject.replace(rulesContent, newRulesContent)
      newContent = content.replace(fullRulesObject, newRulesObject)
    } else {
      // Inline formatting
      const trimmedRulesContent = rulesContent.trim()
      const needsComma = trimmedRulesContent.length > 0
      const separator = needsComma ? ', ' : ''
      const leadingSpace = rulesContent.startsWith(' ') ? ' ' : ''
      const trailingSpace = rulesContent.endsWith(' ') ? ' ' : ''
      const newRulesContent = leadingSpace + trimmedRulesContent + separator + "'@cspell/spellchecker': 'off'" + trailingSpace
      const newRulesObject = fullRulesObject.replace(rulesContent, newRulesContent)
      newContent = content.replace(fullRulesObject, newRulesObject)
    }
  } else {
    // No rules object exists, add one to the end of the array
    // Find the closing bracket of the export default array
    const closingBracketIndex = content.lastIndexOf(']')
    if (closingBracketIndex === -1) {
      return { changed: false, newContent: content }
    }

    // Check what comes before the closing bracket
    const beforeClosing = content.slice(0, closingBracketIndex).trimEnd()

    // Always add a comma and space before the new object
    newContent = beforeClosing + ', { rules: { \'@cspell/spellchecker\': \'off\' } }]' + content.slice(closingBracketIndex + 1)
  }

  if (newContent === content) {
    return { changed: false, newContent: content }
  }

  return { changed: true, newContent }
}

export type ModernizeSpellcheckOptions = BaseMigrationOptions

export const modernizeSpellcheck = async (options: Readonly<ModernizeSpellcheckOptions>): Promise<MigrationResult> => {
  try {
    const eslintConfigPath = new URL('eslint.config.js', options.clonedRepoUri).toString()

    // Check if eslint.config.js exists
    const exists = await options.fs.exists(eslintConfigPath)
    if (!exists) {
      return emptyMigrationResult
    }

    const content = await options.fs.readFile(eslintConfigPath, 'utf8')
    const { changed, newContent } = processFile(content)

    if (!changed) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/modernize-spellcheck',
      changedFiles: [
        {
          content: newContent,
          path: 'eslint.config.js',
        },
      ],
      commitMessage: 'ci: disable cspell/spellchecker in eslint config',
      pullRequestTitle: 'ci: disable cspell/spellchecker in eslint config',
      status: 'success',
      statusCode: 201,
    }
  } catch (error) {
    const errorResult = {
      errorCode: ERROR_CODES.MODERNIZE_SPELLCHECK_FAILED,
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
