import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { ERROR_CODES } from '../ErrorCodes/ErrorCodes.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { stringifyError } from '../StringifyError/StringifyError.ts'

const hasSpellcheckerRule = (content: string): boolean => {
  return content.includes("'@cspell/spellchecker': 'off'") || content.includes('"@cspell/spellchecker": "off"')
}

const findLastNonEmptyLineIndex = (lines: readonly string[]): number => {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      return i
    }
  }
  return -1
}

const updateMultilineRules = (content: string, fullRulesObject: string, rulesContent: string): string => {
  const lines = rulesContent.split('\n')
  const lastContentLineIndex = findLastNonEmptyLineIndex(lines)
  if (lastContentLineIndex === -1) {
    return content
  }

  const lastContentLine = lines[lastContentLineIndex]
  const match = lastContentLine.match(/^(\s+)/)
  const indent = match ? match[1] : '      '
  if (!lastContentLine.trimEnd().endsWith(',')) {
    lines[lastContentLineIndex] = `${lastContentLine},`
  }
  lines.splice(lastContentLineIndex + 1, 0, `${indent}'@cspell/spellchecker': 'off'`)

  const newRulesContent = lines.join('\n')
  const newRulesObject = fullRulesObject.replace(rulesContent, newRulesContent)
  return content.replace(fullRulesObject, newRulesObject)
}

const updateInlineRules = (content: string, fullRulesObject: string, rulesContent: string): string => {
  const trimmedRulesContent = rulesContent.trim()
  const separator = trimmedRulesContent.length > 0 ? ', ' : ''
  const leadingSpace = rulesContent.startsWith(' ') ? ' ' : ''
  const trailingSpace = rulesContent.endsWith(' ') ? ' ' : ''
  const newRulesContent = `${leadingSpace}${trimmedRulesContent}${separator}'@cspell/spellchecker': 'off'${trailingSpace}`
  const newRulesObject = fullRulesObject.replace(rulesContent, newRulesContent)
  return content.replace(fullRulesObject, newRulesObject)
}

const appendRulesObject = (content: string): string => {
  const closingBracketIndex = content.lastIndexOf(']')
  if (closingBracketIndex === -1) {
    return content
  }
  const beforeClosing = content.slice(0, closingBracketIndex).trimEnd()
  return `${beforeClosing}, { rules: { '@cspell/spellchecker': 'off' } }]${content.slice(closingBracketIndex + 1)}`
}

const processFile = (content: string): { newContent: string; changed: boolean } => {
  if (hasSpellcheckerRule(content)) {
    return { changed: false, newContent: content }
  }

  const exportDefaultMatch = content.match(/export\s+default\s+(\[[\s\S]*\])/)
  if (!exportDefaultMatch) {
    return { changed: false, newContent: content }
  }

  let newContent: string
  const arrayContent = exportDefaultMatch[1]
  const rulesObjectMatch = arrayContent.match(/{[\s\S]*?rules:\s*{([^}]*)}[\s\S]*?}/)

  if (rulesObjectMatch) {
    const rulesContent = rulesObjectMatch[1]
    const fullRulesObject = rulesObjectMatch[0]
    newContent = rulesContent.includes('\n')
      ? updateMultilineRules(content, fullRulesObject, rulesContent)
      : updateInlineRules(content, fullRulesObject, rulesContent)
  } else {
    newContent = appendRulesObject(content)
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
