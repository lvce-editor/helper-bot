import { test, expect } from '@jest/globals'
import { join } from 'node:path'
import { computeNewDockerfileContent } from '../src/parts/ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFetch } from '../src/parts/CreateMockFetch/CreateMockFetch.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'

const mockExec = createMockExec()
const mockFetch = createMockFetch([
  { lts: 'Iron', version: 'v20.0.0' },
  { lts: false, version: 'v19.0.0' },
  { lts: 'Hydrogen', version: 'v18.0.0' },
])

test('updates node version in Dockerfile', async () => {
  const content = `FROM node:18.0.0
WORKDIR /app
COPY . .
RUN npm install`

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'Dockerfile')]: content,
    },
  })

  const result = await computeNewDockerfileContent({
    clonedRepoPath,
    exec: mockExec,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('Dockerfile')
  expect(result.changedFiles[0].content).toContain('node:20.0.0')
  expect(result.changedFiles[0].content).not.toContain('node:18.0.0')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
  expect(result.branchName).toBe('feature/update-node-version')
  expect(result.commitMessage).toBe('ci: update Node.js to version v20.0.0')
})

test('returns same content when no node version found', async () => {
  const content = `FROM alpine:latest
WORKDIR /app
COPY . .`

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'Dockerfile')]: content,
    },
  })

  const result = await computeNewDockerfileContent({
    clonedRepoPath,
    exec: mockExec,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles missing Dockerfile', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()

  const result = await computeNewDockerfileContent({
    clonedRepoPath,
    exec: mockExec,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
