import { test, expect } from '@jest/globals'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'
import { computeNewNvmrcContent } from '../src/parts/ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFetch } from '../src/parts/CreateMockFetch/CreateMockFetch.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'

const mockExec = createMockExec()
const mockFetch = createMockFetch([
  { lts: 'Iron', version: 'v20.0.0' },
  { lts: false, version: 'v19.0.0' },
  { lts: 'Hydrogen', version: 'v18.0.0' },
])

test('computes new nvmrc content when version should be updated', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.nvmrc', clonedRepoUri).toString()]: 'v18.0.0',
    },
  })

  const result = await computeNewNvmrcContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.nvmrc')
  expect(result.changedFiles[0].content).toBe('v20.0.0\n')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
  expect(result.branchName).toBe('feature/update-node-version')
  expect(result.commitMessage).toBe('ci: update Node.js to version v20.0.0')
})

test('returns same content when existing version is newer', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.nvmrc', clonedRepoUri).toString()]: 'v22.0.0',
    },
  })

  const result = await computeNewNvmrcContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe('')
})

test('handles missing .nvmrc file', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await computeNewNvmrcContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
