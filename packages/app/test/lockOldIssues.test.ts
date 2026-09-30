import { expect, jest, test } from '@jest/globals'
import { lockOldConversations, nextScheduledRun, parseIssueLockingConfig, scheduleIssueLocking } from '@lvce-editor/lock-old-issues'

const now = Date.parse('2026-09-30T05:00:00.000Z')
const config = parseIssueLockingConfig({ enabled: true, repositories: ['lvce-editor/helper-bot'], olderThanDays: 45, writeIntervalMs: 1 })

const createOctokit = (
  items: readonly any[],
  currentItems: Record<number, any> = {},
  pullItems: Record<number, any> = {},
  extraPages: Record<number, readonly any[]> = {},
) => {
  const listForRepo = jest.fn(async (options: Record<string, any>) => ({ data: extraPages[options.page] || (options.page === 1 ? items : []) }))
  const get = jest.fn(async (options: Record<string, any>) => ({
    data: currentItems[options.issue_number] || { ...items.find((item) => item.number === options.issue_number), state: 'closed' },
  }))
  const pullGet = jest.fn(async (options: Record<string, any>) => ({ data: pullItems[options.pull_number] || {} }))
  const lock = jest.fn(async () => undefined)
  return { octokit: { issues: { listForRepo, get, lock }, pulls: { get: pullGet } }, listForRepo, get, pullGet, lock }
}

test('uses safe defaults and rejects invalid locking configuration', () => {
  expect(parseIssueLockingConfig(undefined)).toMatchObject({
    enabled: false,
    repositories: [],
    olderThanDays: 45,
    schedule: { hour: 7, minute: 0, timeZone: 'Europe/Berlin' },
  })
  expect(() => parseIssueLockingConfig({ enabled: true, repositories: ['not-a-repository'] })).toThrow('owner/repository')
  expect(() => parseIssueLockingConfig({ enabled: true, repositories: ['owner/repo'], maxPagesPerRun: 11 })).toThrow('maxPagesPerRun')
  expect(() => parseIssueLockingConfig({ schedule: { timeZone: 'Mars/Olympus' } })).toThrow('IANA time zone')
})

test('does not access GitHub when disabled or repository is outside the allowlist', async () => {
  const { octokit, listForRepo } = createOctokit([])
  expect(await lockOldConversations({ octokit, repository: 'lvce-editor/helper-bot', config: parseIssueLockingConfig(undefined), now })).toBe(0)
  expect(await lockOldConversations({ octokit, repository: 'lvce-editor/other', config, now })).toBe(0)
  expect(listForRepo).not.toHaveBeenCalled()
})

test('locks old closed issues and merged PRs, while rechecking reopened and unmerged items', async () => {
  const cutoff = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString()
  const items = [
    { number: 1, closed_at: cutoff, locked: false },
    { number: 2, closed_at: '2026-07-01T00:00:00.000Z', locked: false, pull_request: {} },
    { number: 3, closed_at: '2026-07-01T00:00:00.000Z', locked: false, pull_request: {} },
    { number: 4, closed_at: '2026-09-20T00:00:00.000Z', locked: false },
    { number: 5, closed_at: '2026-07-01T00:00:00.000Z', locked: true },
  ]
  const { octokit, lock, get, pullGet } = createOctokit(
    items,
    { 2: { state: 'closed', locked: false, pull_request: {} }, 3: { state: 'open', locked: false }, 1: { state: 'closed', locked: false } },
    { 2: { merged_at: '2026-07-01T00:00:00.000Z' } },
  )
  expect(await lockOldConversations({ octokit, repository: 'lvce-editor/helper-bot', config, now })).toBe(2)
  expect(lock.mock.calls.map(([options]) => options.issue_number)).toEqual([1, 2])
  expect(get.mock.calls.map(([options]) => options.issue_number)).toEqual([1, 2, 3])
  expect(pullGet.mock.calls.map(([options]) => options.pull_number)).toEqual([2])
})

test('bounds pages and candidate work in each run', async () => {
  const manyItems = Array.from({ length: 100 }, (_, index) => ({ number: index + 1, closed_at: '2026-07-01T00:00:00.000Z', locked: false }))
  const { octokit, listForRepo, lock } = createOctokit(manyItems)
  const limitedConfig = parseIssueLockingConfig({ ...config, maxItemsPerRun: 3, maxPagesPerRun: 1 })
  expect(await lockOldConversations({ octokit, repository: 'lvce-editor/helper-bot', config: limitedConfig, now })).toBe(3)
  expect(listForRepo).toHaveBeenCalledTimes(1)
  expect(lock).toHaveBeenCalledTimes(3)
})

test('continues to the next result page when the first page has no lockable records', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ number: index + 1, closed_at: '2026-07-01T00:00:00.000Z', locked: true }))
  const secondPage = [{ number: 101, closed_at: '2026-07-01T00:00:00.000Z', locked: false }]
  const { octokit, listForRepo, lock } = createOctokit(firstPage, {}, {}, { 2: secondPage })
  const pagedConfig = parseIssueLockingConfig({ ...config, maxPagesPerRun: 2 })
  expect(await lockOldConversations({ octokit, repository: 'lvce-editor/helper-bot', config: pagedConfig, now })).toBe(1)
  expect(listForRepo.mock.calls.map(([options]) => options.page)).toEqual([1, 2])
  expect(lock).toHaveBeenCalledTimes(1)
})

test('defers the remaining work after a GitHub rate limit', async () => {
  const items = [1, 2].map((number) => ({ number, closed_at: '2026-07-01T00:00:00.000Z', locked: false }))
  const { octokit, lock } = createOctokit(items)
  lock.mockRejectedValueOnce(
    Object.assign(new Error('rate limited'), { status: 403, response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '123' } } }),
  )
  const logs: string[] = []
  expect(await lockOldConversations({ octokit, repository: 'lvce-editor/helper-bot', config, now, log: (message) => logs.push(message) })).toBe(0)
  expect(lock).toHaveBeenCalledTimes(1)
  expect(logs[0]).toContain('reset at 123')
})

test('defers the repository after a permission failure', async () => {
  const items = [1, 2].map((number) => ({ number, closed_at: '2026-07-01T00:00:00.000Z', locked: false }))
  const { octokit, get, lock } = createOctokit(items)
  lock.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403, response: { headers: {} } }))
  const logs: string[] = []
  expect(await lockOldConversations({ octokit, repository: 'lvce-editor/helper-bot', config, now, log: (message) => logs.push(message) })).toBe(0)
  expect(lock).toHaveBeenCalledTimes(1)
  expect(get).toHaveBeenCalledTimes(1)
  expect(logs[0]).toContain('GitHub denied permission')
})

test('schedules the selected Berlin wall time across daylight-saving changes', () => {
  const schedule = { hour: 7, minute: 0, timeZone: 'Europe/Berlin' }
  expect(new Date(nextScheduledRun(Date.parse('2026-03-28T22:00:00Z'), schedule)).toISOString()).toBe('2026-03-29T05:00:00.000Z')
  expect(new Date(nextScheduledRun(Date.parse('2026-10-24T22:00:00Z'), schedule)).toISOString()).toBe('2026-10-25T06:00:00.000Z')
})

test('does not run overlapping scheduled jobs and can be stopped', async () => {
  jest.useFakeTimers()
  let currentTime = Date.parse('2026-09-30T04:00:00Z')
  const run = jest.fn(async () => undefined)
  const stop = scheduleIssueLocking({ config, run, now: () => currentTime })
  currentTime = Date.parse('2026-09-30T05:00:00Z')
  await jest.advanceTimersByTimeAsync(60 * 60 * 1000)
  expect(run).toHaveBeenCalledTimes(1)
  stop()
  await jest.runOnlyPendingTimersAsync()
  expect(run).toHaveBeenCalledTimes(1)
  jest.useRealTimers()
})
