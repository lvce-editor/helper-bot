export const ALLOWED_TARGET_REPOSITORY_OWNER = 'lvce-editor'

const targetRepositoryPattern = /^(?<owner>[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)\/(?<repo>[A-Za-z0-9._-]+)$/
const sensitiveOptionNamePattern =
  /^(access[-_]?token|api[-_]?key|auth[-_]?token|bearer|client[-_]?secret|credential|credentials|github[-_]?token|password|passphrase|private[-_]?key|secret|token)$/i
const baseBranchPattern = /^(?!\/)(?!.*\.\.)(?!.*\/$)[A-Za-z0-9._/-]+$/

export interface ParsedTargetRepository {
  readonly owner: string
  readonly repo: string
}

const getSensitiveOptionPath = (value: unknown, path = ''): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const sensitivePath = getSensitiveOptionPath(value[index], `${path}[${index}]`)
      if (sensitivePath) {
        return sensitivePath
      }
    }
    return undefined
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const currentPath = path ? `${path}.${key}` : key
    if (sensitiveOptionNamePattern.test(key)) {
      return currentPath
    }
    const sensitivePath = getSensitiveOptionPath(nestedValue, currentPath)
    if (sensitivePath) {
      return sensitivePath
    }
  }
  return undefined
}

export const parseTargetRepository = (targetRepository: string): ParsedTargetRepository | undefined => {
  const match = targetRepository.match(targetRepositoryPattern)
  if (!match || !match.groups) {
    return undefined
  }
  return {
    owner: match.groups.owner,
    repo: match.groups.repo,
  }
}

export const isValidBaseBranch = (baseBranch: string): boolean => {
  return baseBranchPattern.test(baseBranch)
}

export const assertAllowedTargetRepository = (targetRepository: string): ParsedTargetRepository => {
  const parsed = parseTargetRepository(targetRepository)
  if (!parsed) {
    throw new Error('Invalid target repository')
  }
  if (parsed.owner !== ALLOWED_TARGET_REPOSITORY_OWNER) {
    throw new Error(`Target repository must belong to ${ALLOWED_TARGET_REPOSITORY_OWNER}`)
  }
  return parsed
}

export const assertSafeMigrationOptions = (migrationOptions: Record<string, unknown>): void => {
  const sensitivePath = getSensitiveOptionPath(migrationOptions)
  if (sensitivePath) {
    throw new Error(`Migration option "${sensitivePath}" looks like a secret and must not be sent to the workflow`)
  }
}
