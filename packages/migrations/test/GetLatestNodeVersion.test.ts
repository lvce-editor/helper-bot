import { test, expect } from '@jest/globals'
import { createMockFetch } from '../src/parts/CreateMockFetch/CreateMockFetch.ts'
import { getLatestNodeVersion } from '../src/parts/GetLatestNodeVersion/GetLatestNodeVersion.ts'

test('returns latest LTS version', async () => {
  const mockVersions = [
    { version: 'v20.0.0', lts: 'Iron' as const },
    { version: 'v19.0.0', lts: false as const },
    { version: 'v18.0.0', lts: 'Hydrogen' as const },
  ]

  const mockFetch = createMockFetch(mockVersions)

  const version = await getLatestNodeVersion(
    mockFetch as unknown as typeof globalThis.fetch,
  )

  expect(version).toBe('v20.0.0')
})

test('throws error when no LTS version found', async () => {
  const mockVersions = [
    { version: 'v19.0.0', lts: false as const },
    { version: 'v18.0.0', lts: false as const },
  ]

  const mockFetch = createMockFetch(mockVersions)

  await expect(
    getLatestNodeVersion(mockFetch as unknown as typeof globalThis.fetch),
  ).rejects.toThrow('No LTS version found')
})
