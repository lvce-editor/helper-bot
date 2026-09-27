const TIME_ZONE = 'Europe/Berlin'
const DISPATCH_HOUR = 4

export type DelayedReleaseUpdate = {
  readonly key: string
  readonly tagName: string
  readonly dispatch: () => Promise<void>
}

const datePartsAt = (timestamp: number) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

const berlinWallClockToTimestamp = (year: number, month: number, day: number, hour: number): number => {
  const wallClockTimestamp = Date.UTC(year, month - 1, day, hour)
  let timestamp = wallClockTimestamp
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = datePartsAt(timestamp)
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
    timestamp = wallClockTimestamp - (localAsUtc - timestamp)
  }
  return timestamp
}

export const nextBerlinFourAm = (now = Date.now()): number => {
  const local = datePartsAt(now)
  let { year, month, day } = local
  if (local.hour >= DISPATCH_HOUR) {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
    year = tomorrow.getUTCFullYear()
    month = tomorrow.getUTCMonth() + 1
    day = tomorrow.getUTCDate()
  }
  return berlinWallClockToTimestamp(year, month, day, DISPATCH_HOUR)
}

const compareReleaseTags = (left: string, right: string): number => {
  const leftParts = left.replace(/^v/, '').split('.').map(Number)
  const rightParts = right.replace(/^v/, '').split('.').map(Number)
  if (leftParts.some((part) => !Number.isSafeInteger(part) || part < 0) || rightParts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
    return left.localeCompare(right)
  }
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index++) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

const updates = new Map<string, DelayedReleaseUpdate>()
const latestTags = new Map<string, string>()
let timer: NodeJS.Timeout | undefined
let draining = false

const scheduleDrain = (): void => {
  if (timer || updates.size === 0 || draining) {
    return
  }
  timer = setTimeout(
    () => {
      timer = undefined
      void drainDelayedReleaseUpdates()
    },
    Math.max(0, nextBerlinFourAm() - Date.now()),
  )
  timer.unref()
}

export const enqueueDelayedReleaseUpdate = (update: DelayedReleaseUpdate): void => {
  const latestTag = latestTags.get(update.key)
  if (latestTag && compareReleaseTags(update.tagName, latestTag) <= 0) {
    return
  }
  latestTags.set(update.key, update.tagName)
  updates.set(update.key, update)
  scheduleDrain()
}

export const drainDelayedReleaseUpdates = async (): Promise<void> => {
  if (draining || updates.size === 0) {
    return
  }
  draining = true
  const snapshot = [...updates.values()]
  for (const update of snapshot) {
    if (updates.get(update.key) === update) {
      updates.delete(update.key)
    }
  }
  try {
    await Promise.allSettled(snapshot.map((update) => update.dispatch()))
  } finally {
    draining = false
    scheduleDrain()
  }
}

export const resetDelayedReleaseUpdates = (): void => {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  updates.clear()
  latestTags.clear()
  draining = false
}
