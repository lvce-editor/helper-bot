export type IssueLockingConfig = {
  readonly enabled: boolean
  readonly repositories: readonly string[]
  readonly olderThanDays: number
  readonly schedule: {
    readonly hour: number
    readonly minute: number
    readonly timeZone: string
  }
  readonly maxPagesPerRun: number
  readonly maxItemsPerRun: number
  readonly writeIntervalMs: number
}

export type LockingOctokit = {
  readonly issues: {
    listForRepo(options: Record<string, unknown>): Promise<{ data: readonly any[] }>
    get(options: Record<string, unknown>): Promise<{ data: any }>
    lock(options: Record<string, unknown>): Promise<unknown>
  }
  readonly pulls: {
    get(options: Record<string, unknown>): Promise<{ data: any }>
  }
}

type RepoConfig = { readonly owner: string; readonly repo: string }

const defaultConfig: IssueLockingConfig = {
  enabled: false,
  maxItemsPerRun: 100,
  maxPagesPerRun: 5,
  olderThanDays: 45,
  repositories: [],
  schedule: { hour: 7, minute: 0, timeZone: 'Europe/Berlin' },
  writeIntervalMs: 1000,
}

const isRecord = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value)

const positiveInteger = (value: unknown, name: string, maximum: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw new Error(`issueLocking.${name} must be an integer between 1 and ${maximum}`)
  }
  return value as number
}

export const parseIssueLockingConfig = (value: unknown): IssueLockingConfig => {
  if (value === undefined) {
    return defaultConfig
  }
  if (!isRecord(value)) {
    throw new Error('issueLocking must be an object')
  }
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    throw new Error('issueLocking.enabled must be a boolean')
  }
  const repositories = value.repositories || []
  if (
    !Array.isArray(repositories) ||
    repositories.some((repository) => typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
  ) {
    throw new Error('issueLocking.repositories must be an array of owner/repository names')
  }
  const schedule = value.schedule || {}
  if (!isRecord(schedule)) {
    throw new Error('issueLocking.schedule must be an object')
  }
  const hour = schedule.hour ?? defaultConfig.schedule.hour
  const minute = schedule.minute ?? defaultConfig.schedule.minute
  if (!Number.isSafeInteger(hour) || hour < 0 || hour > 23 || !Number.isSafeInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('issueLocking.schedule hour and minute must be a valid 24-hour time')
  }
  const timeZone = schedule.timeZone ?? defaultConfig.schedule.timeZone
  if (typeof timeZone !== 'string' || !timeZone) {
    throw new Error('issueLocking.schedule.timeZone must be a valid IANA time zone')
  }
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format(0)
  } catch {
    throw new Error('issueLocking.schedule.timeZone must be a valid IANA time zone')
  }
  const olderThanDays = positiveInteger(value.olderThanDays ?? defaultConfig.olderThanDays, 'olderThanDays', 36_500)
  const maxPagesPerRun = positiveInteger(value.maxPagesPerRun ?? defaultConfig.maxPagesPerRun, 'maxPagesPerRun', 10)
  const maxItemsPerRun = positiveInteger(value.maxItemsPerRun ?? defaultConfig.maxItemsPerRun, 'maxItemsPerRun', 100)
  const writeIntervalMs = positiveInteger(value.writeIntervalMs ?? defaultConfig.writeIntervalMs, 'writeIntervalMs', 60_000)
  return {
    enabled: value.enabled ?? false,
    maxItemsPerRun,
    maxPagesPerRun,
    olderThanDays,
    repositories: [...new Set(repositories)],
    schedule: { hour, minute, timeZone },
    writeIntervalMs,
  }
}

const repoParts = (repository: string): RepoConfig => {
  const [owner, repo] = repository.split('/')
  return { owner, repo }
}

const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds))

const isRateLimitError = (error: any): boolean =>
  error?.status === 429 || (error?.status === 403 && (error?.response?.headers?.['x-ratelimit-remaining'] === '0' || error?.response?.headers?.['retry-after']))
const isPermissionError = (error: any): boolean => error?.status === 403 && !isRateLimitError(error)

const logError = (log: (message: string) => void, repository: string, operation: string, error: any): void => {
  if (isRateLimitError(error)) {
    const retryAfter = error?.response?.headers?.['retry-after']
    const resetAt = error?.response?.headers?.['x-ratelimit-reset']
    const details = [retryAfter && `retry after ${retryAfter}s`, resetAt && `reset at ${resetAt}`].filter(Boolean).join('; ')
    const suffix = details ? `; ${details}` : ''
    log(`Issue locking deferred for ${repository}: GitHub rate limit during ${operation}${suffix}`)
    return
  }
  if (isPermissionError(error)) {
    log(`Issue locking deferred for ${repository}: GitHub denied permission during ${operation}`)
    return
  }
  log(`Issue locking failed for ${repository} during ${operation}: ${error instanceof Error ? error.message : String(error)}`)
}

const lockCandidate = async ({
  config,
  cutoff,
  item,
  log,
  octokit,
  owner,
  repo,
  waitBeforeWrite,
}: {
  readonly config: IssueLockingConfig
  readonly item: any
  readonly octokit: LockingOctokit
  readonly owner: string
  readonly repo: string
  readonly cutoff: number
  readonly log: (message: string) => void
  readonly waitBeforeWrite: boolean
}): Promise<'locked' | 'skipped' | 'deferred'> => {
  try {
    const { data: current } = await octokit.issues.get({ issue_number: item.number, owner, repo })
    if (current.state !== 'closed' || current.locked) {
      return 'skipped'
    }
    if (current.pull_request) {
      const { data: pull } = await octokit.pulls.get({ owner, pull_number: item.number, repo })
      const mergedAt = Date.parse(pull.merged_at || '')
      if (!Number.isFinite(mergedAt) || mergedAt > cutoff) {
        return 'skipped'
      }
    } else if (Date.parse(current.closed_at || '') > cutoff) {
      return 'skipped'
    }
    if (waitBeforeWrite) {
      await delay(config.writeIntervalMs)
    }
    await octokit.issues.lock({ issue_number: item.number, owner, repo })
    return 'locked'
  } catch (error) {
    logError(log, `${owner}/${repo}`, `checking or locking #${item.number}`, error)
    return isRateLimitError(error) || isPermissionError(error) ? 'deferred' : 'skipped'
  }
}

const lockPage = async ({
  config,
  cutoff,
  examined,
  items,
  locked,
  log,
  octokit,
  owner,
  repo,
}: {
  readonly config: IssueLockingConfig
  readonly cutoff: number
  readonly examined: number
  readonly items: readonly any[]
  readonly locked: number
  readonly log: (message: string) => void
  readonly octokit: LockingOctokit
  readonly owner: string
  readonly repo: string
}): Promise<{ readonly examined: number; readonly locked: number; readonly rateLimited: boolean }> => {
  let candidateCount = examined
  let lockCount = locked
  for (const item of items) {
    if (candidateCount >= config.maxItemsPerRun || lockCount >= config.maxItemsPerRun) {
      break
    }
    const closedAt = Date.parse(item.closed_at || '')
    if (!Number.isFinite(closedAt) || closedAt > cutoff || item.locked) {
      continue
    }
    candidateCount++
    const result = await lockCandidate({ config, cutoff, item, log, octokit, owner, repo, waitBeforeWrite: lockCount > 0 })
    if (result === 'locked') {
      lockCount++
    } else if (result === 'deferred') {
      return { examined: candidateCount, locked: lockCount, rateLimited: true }
    }
  }
  return { examined: candidateCount, locked: lockCount, rateLimited: false }
}

export const lockOldConversations = async ({
  config,
  log = console.warn,
  now = Date.now(),
  octokit,
  repository,
}: {
  readonly octokit: LockingOctokit
  readonly repository: string
  readonly config: IssueLockingConfig
  readonly now?: number
  readonly log?: (message: string) => void
}): Promise<number> => {
  if (!config.enabled || !config.repositories.includes(repository)) {
    return 0
  }
  const { owner, repo } = repoParts(repository)
  const cutoff = now - config.olderThanDays * 24 * 60 * 60 * 1000
  let page = 1
  const counts = { examined: 0, locked: 0 }
  while (page <= config.maxPagesPerRun && counts.examined < config.maxItemsPerRun && counts.locked < config.maxItemsPerRun) {
    let items: readonly any[]
    try {
      const response = await octokit.issues.listForRepo({ direction: 'asc', owner, page, per_page: 100, repo, sort: 'updated', state: 'closed' })
      items = response.data
    } catch (error) {
      logError(log, repository, 'listing closed items', error)
      break
    }
    if (items.length === 0) {
      break
    }
    const result = await lockPage({ config, cutoff, ...counts, items, log, octokit, owner, repo })
    Object.assign(counts, result)
    if (result.rateLimited) {
      return counts.locked
    }
    if (items.length < 100) {
      break
    }
    page++
  }
  return counts.locked
}

const partsAt = (timestamp: number, formatter: Intl.DateTimeFormat): Record<string, number> => {
  const parts = formatter.formatToParts(timestamp)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    month: Number(values.month),
    year: Number(values.year),
  }
}

export const nextScheduledRun = (now: number, schedule: IssueLockingConfig['schedule']): number => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: schedule.timeZone,
    year: 'numeric',
  })
  const localNow = partsAt(now, formatter)
  const localDate = new Date(
    Date.UTC(localNow.year, localNow.month - 1, localNow.day + (localNow.hour * 60 + localNow.minute >= schedule.hour * 60 + schedule.minute ? 1 : 0)),
  )
  const target = { day: localDate.getUTCDate(), month: localDate.getUTCMonth() + 1, year: localDate.getUTCFullYear() }
  const start = Math.floor(now / 60_000) * 60_000 + 60_000
  for (let timestamp = start; timestamp < start + 48 * 60 * 60 * 1000; timestamp += 60_000) {
    const local = partsAt(timestamp, formatter)
    if (
      local.year === target.year &&
      local.month === target.month &&
      local.day === target.day &&
      local.hour === schedule.hour &&
      local.minute === schedule.minute
    ) {
      return timestamp
    }
  }
  throw new Error(`Unable to find next run for ${schedule.timeZone}`)
}

export const scheduleIssueLocking = ({
  config,
  log = console.error,
  now = Date.now,
  run,
}: {
  readonly config: IssueLockingConfig
  readonly run: () => Promise<void>
  readonly log?: (error: unknown) => void
  readonly now?: () => number
}): (() => void) => {
  if (!config.enabled || config.repositories.length === 0) {
    return () => {}
  }
  let stopped = false
  let running = false
  let timer: NodeJS.Timeout | undefined
  const runAndReschedule = async (): Promise<void> => {
    timer = undefined
    if (!running) {
      running = true
      try {
        await run()
      } catch (error) {
        log(error)
      } finally {
        running = false
      }
    }
    scheduleNext()
  }
  const scheduleNext = (): void => {
    if (stopped) {
      return
    }
    const currentTime = now()
    const waitTime = nextScheduledRun(currentTime, config.schedule) - currentTime
    timer = setTimeout(() => void runAndReschedule(), Math.max(1, waitTime))
    timer.unref()
  }
  scheduleNext()
  return () => {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }
}
