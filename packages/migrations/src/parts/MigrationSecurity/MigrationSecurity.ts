export const ALLOWED_TARGET_REPOSITORY_OWNER = 'lvce-editor'

export interface ParsedTargetRepository {
  readonly owner: string
  readonly repo: string
}

export const parseTargetRepository = (targetRepository: string): ParsedTargetRepository | undefined => {
  const parts = targetRepository.split('/')
  if (parts.length !== 2) {
    return undefined
  }
  const [owner, repo] = parts
  if (!owner || !repo) {
    return undefined
  }
  if (owner.length > 39 || owner.startsWith('-') || owner.endsWith('-')) {
    return undefined
  }
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
    return undefined
  }
  return {
    owner,
    repo,
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
