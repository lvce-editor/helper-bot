export const ALLOWED_TARGET_REPOSITORY_OWNER = 'lvce-editor'

const targetRepositoryPattern = /^(?<owner>[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)\/(?<repo>[A-Za-z0-9._-]+)$/

export interface ParsedTargetRepository {
  readonly owner: string
  readonly repo: string
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
