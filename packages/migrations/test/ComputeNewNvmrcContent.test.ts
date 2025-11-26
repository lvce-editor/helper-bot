import { test, expect } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { computeNewNvmrcContent } from '../src/parts/ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('computes new nvmrc content when version should be updated', async () => {
  const mockFetch = async () => {
    return {
      json: async () => [
        { version: 'v20.0.0', lts: 'Iron' },
        { version: 'v19.0.0', lts: false },
        { version: 'v18.0.0', lts: 'Hydrogen' },
      ],
    } as Response
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.writeFile(join(tempDir, '.nvmrc'), 'v18.0.0')

    const result = await computeNewNvmrcContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toHaveLength(1)
    expect(result.changedFiles[0].path).toBe('.nvmrc')
    expect(result.changedFiles[0].content).toBe('v20.0.0\n')
    expect(result.pullRequestTitle).toBe(
      'ci: update Node.js to version v20.0.0',
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('returns same content when existing version is newer', async () => {
  const mockFetch = async () => {
    return {
      json: async () => [
        { version: 'v20.0.0', lts: 'Iron' },
        { version: 'v19.0.0', lts: false },
        { version: 'v18.0.0', lts: 'Hydrogen' },
      ],
    } as Response
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.writeFile(join(tempDir, '.nvmrc'), 'v22.0.0')

    const result = await computeNewNvmrcContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
    expect(result.pullRequestTitle).toBe(
      'ci: update Node.js to version v20.0.0',
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('handles missing .nvmrc file', async () => {
  const mockFetch = async () => {
    return {
      json: async () => [
        { version: 'v20.0.0', lts: 'Iron' },
        { version: 'v19.0.0', lts: false },
        { version: 'v18.0.0', lts: 'Hydrogen' },
      ],
    } as Response
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    const result = await computeNewNvmrcContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
