import { afterEach, expect, jest, test } from '@jest/globals'
import {
  drainDelayedReleaseUpdates,
  enqueueDelayedReleaseUpdate,
  nextBerlinFourAm,
  resetDelayedReleaseUpdates,
} from '../src/parts/DelayedReleaseUpdates/DelayedReleaseUpdates.ts'

afterEach(() => {
  resetDelayedReleaseUpdates()
  jest.useRealTimers()
})

test.each([
  ['summer time', '2026-07-01T00:00:00.000Z', '2026-07-01T02:00:00.000Z'],
  ['winter time', '2026-01-01T00:00:00.000Z', '2026-01-01T03:00:00.000Z'],
  ['spring transition day', '2026-03-29T00:30:00.000Z', '2026-03-29T02:00:00.000Z'],
  ['autumn transition day', '2026-10-25T00:30:00.000Z', '2026-10-25T03:00:00.000Z'],
  ["after today's deadline", '2026-07-01T03:00:00.000Z', '2026-07-02T02:00:00.000Z'],
])('schedules 04:00 Berlin time for %s', (_name, now, expected) => {
  expect(new Date(nextBerlinFourAm(Date.parse(now))).toISOString()).toBe(expected)
})

test('drains one newest release per update target', async () => {
  const dispatch = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.0.0', dispatch })
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.2.0', dispatch })
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.1.0', dispatch })
  enqueueDelayedReleaseUpdate({ key: 'benchmark', tagName: 'v1.2.0', dispatch })

  await drainDelayedReleaseUpdates()

  expect(dispatch).toHaveBeenCalledTimes(2)
})

test('ignores duplicate and older releases after a completed drain', async () => {
  const dispatch = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.2.0', dispatch })
  await drainDelayedReleaseUpdates()
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.2.0', dispatch })
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.1.0', dispatch })
  await drainDelayedReleaseUpdates()
  expect(dispatch).toHaveBeenCalledTimes(1)
})

test('keeps updates arriving during a drain queued for the next day', async () => {
  let finishDispatch!: () => void
  const dispatch = jest
    .fn<() => Promise<void>>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDispatch = resolve
        }),
    )
    .mockResolvedValue(undefined)
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.0.0', dispatch })
  const draining = drainDelayedReleaseUpdates()
  enqueueDelayedReleaseUpdate({ key: 'benchmark', tagName: 'v1.1.0', dispatch })
  finishDispatch()
  await draining

  expect(dispatch).toHaveBeenCalledTimes(1)
  await drainDelayedReleaseUpdates()
  expect(dispatch).toHaveBeenCalledTimes(2)
})

test('continues draining after a dispatch error and leaves the queue empty', async () => {
  const failedDispatch = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('failed'))
  const successfulDispatch = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.0.0', dispatch: failedDispatch })
  enqueueDelayedReleaseUpdate({ key: 'benchmark', tagName: 'v1.0.0', dispatch: successfulDispatch })

  await expect(drainDelayedReleaseUpdates()).resolves.toBeUndefined()
  expect(failedDispatch).toHaveBeenCalledTimes(1)
  expect(successfulDispatch).toHaveBeenCalledTimes(1)
})

test('clears pending work and its timer when reset', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-07-01T00:00:00.000Z'))
  const dispatch = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  enqueueDelayedReleaseUpdate({ key: 'website', tagName: 'v1.0.0', dispatch })
  resetDelayedReleaseUpdates()
  await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
  expect(dispatch).not.toHaveBeenCalled()
})

test('an empty queue does no work', async () => {
  await expect(drainDelayedReleaseUpdates()).resolves.toBeUndefined()
})
