import { test, expect } from '@jest/globals'
import { join } from 'node:path'
import { computeNewNvmrcContent } from '../src/parts/ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFetch } from '../src/parts/CreateMockFetch/CreateMockFetch.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'

const mockExec = createMockExec()
const mockFetch = createMockFetch([
  { version: 'v20.0.0', lts: 'Iron' },
  { version: 'v19.0.0', lts: false },
  { version: 'v18.0.0', lts: 'Hydrogen' },
])

test('computes new nvmrc content when version should be updated', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, '.nvmrc')]: 'v18.0.0',
    },
  })

  const result = await computeNewNvmrcContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    fs: mockFs,
    clonedRepoPath,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.nvmrc')
  expect(result.changedFiles[0].content).toBe('v20.0.0\n')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('returns same content when existing version is newer', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, '.nvmrc')]: 'v22.0.0',
    },
  })

  const result = await computeNewNvmrcContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    fs: mockFs,
    clonedRepoPath,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('handles missing .nvmrc file', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()

  const result = await computeNewNvmrcContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    fs: mockFs,
    clonedRepoPath,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
