export interface PlannedRelease {
  readonly repository: string
  readonly tagName: string
}

export interface PendingDependencyUpdate {
  readonly asName?: string
  readonly fromRepo: string
  readonly tagName: string
  readonly toFolder: string
  readonly toRepo: string
}

export interface PendingDependencyUpdateBatch {
  readonly targetRepository: string
  readonly toRepo: string
  readonly updates: readonly PendingDependencyUpdate[]
}

export type PlannedReleaseBatchTimeoutHandler = (batches: readonly PendingDependencyUpdateBatch[]) => void | Promise<void>

interface PlannedReleaseBatchState {
  readonly completedPlannedReleases: Set<string>
  readonly pendingDependencyUpdates: PendingDependencyUpdate[]
  readonly pendingPlannedReleases: Map<string, PlannedRelease>
  readonly timeout?: NodeJS.Timeout
}

let state: PlannedReleaseBatchState | undefined

export const PlannedReleaseBatchTimeout = 5 * 60 * 1000

const getReleaseKey = (repository: string, tagName: string): string => {
  return `${repository}@${tagName}`
}

const getRepoName = (repository: string): string => {
  const parts = repository.split('/')
  return parts.at(-1) || repository
}

export const resetPlannedReleaseBatch = (): void => {
  if (state?.timeout) {
    clearTimeout(state.timeout)
  }
  state = undefined
}

export const startPlannedReleaseBatch = (
  releases: readonly PlannedRelease[],
  onTimeout?: PlannedReleaseBatchTimeoutHandler,
  timeout = PlannedReleaseBatchTimeout,
): void => {
  resetPlannedReleaseBatch()
  const pendingPlannedReleases = new Map<string, PlannedRelease>()
  for (const release of releases) {
    pendingPlannedReleases.set(getReleaseKey(release.repository, release.tagName), release)
  }
  const timeoutHandle =
    onTimeout && pendingPlannedReleases.size > 0
      ? setTimeout(() => {
          const batches = flushPendingDependencyUpdateBatches()
          if (batches.length > 0) {
            void onTimeout(batches)
          }
        }, timeout)
      : undefined
  state = {
    completedPlannedReleases: new Set(),
    pendingDependencyUpdates: [],
    pendingPlannedReleases,
    ...(timeoutHandle && { timeout: timeoutHandle }),
  }
}

export const isPlannedReleasePending = (repository: string, tagName: string): boolean => {
  return state?.pendingPlannedReleases.has(getReleaseKey(repository, tagName)) === true
}

export const addPendingDependencyUpdates = (updates: readonly PendingDependencyUpdate[]): void => {
  if (!state || updates.length === 0) {
    return
  }
  state.pendingDependencyUpdates.push(...updates)
}

export const flushPendingDependencyUpdateBatches = (): readonly PendingDependencyUpdateBatch[] => {
  if (!state) {
    return []
  }
  const batches = getPendingDependencyUpdateBatches()
  resetPlannedReleaseBatch()
  return batches
}

export const markPlannedReleaseCompleted = (repository: string, tagName: string): readonly PendingDependencyUpdateBatch[] => {
  if (!state) {
    return []
  }
  const key = getReleaseKey(repository, tagName)
  if (!state.pendingPlannedReleases.has(key)) {
    return []
  }
  state.completedPlannedReleases.add(key)
  if (state.completedPlannedReleases.size !== state.pendingPlannedReleases.size) {
    return []
  }
  return flushPendingDependencyUpdateBatches()
}

const getPendingDependencyUpdateBatches = (): readonly PendingDependencyUpdateBatch[] => {
  if (!state) {
    return []
  }
  const batches = new Map<string, PendingDependencyUpdate[]>()
  for (const update of state.pendingDependencyUpdates) {
    const targetRepository = `lvce-editor/${update.toRepo}`
    const updates = batches.get(targetRepository) || []
    updates.push(update)
    batches.set(targetRepository, updates)
  }
  return [...batches].map(([targetRepository, updates]) => ({
    targetRepository,
    toRepo: getRepoName(targetRepository),
    updates,
  }))
}
