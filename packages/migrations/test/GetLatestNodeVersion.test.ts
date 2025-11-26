import { test, expect } from '@jest/globals'
import { getLatestNodeVersion } from '../src/parts/GetLatestNodeVersion/GetLatestNodeVersion.ts'

test('returns latest LTS version', async () => {
  const mockVersions = [
    { version: 'v20.0.0', lts: 'Iron' },
    { version: 'v19.0.0', lts: false },
    { version: 'v18.0.0', lts: 'Hydrogen' },
  ]

  const mockFetch = async () => {
    return {
      json: async () => mockVersions,
    }
  }

  const version = await getLatestNodeVersion(
    mockFetch as typeof globalThis.fetch,
  )

  expect(version).toBe('v20.0.0')
})

test('throws error when no LTS version found', async () => {
  const mockVersions = [
    { version: 'v19.0.0', lts: false },
    { version: 'v18.0.0', lts: false },
  ]

  const mockFetch = async () => {
    return {
      json: async () => mockVersions,
    } as Response
  }

  await expect(
    getLatestNodeVersion(mockFetch as unknown as typeof globalThis.fetch),
  ).rejects.toThrow('No LTS version found')
})
