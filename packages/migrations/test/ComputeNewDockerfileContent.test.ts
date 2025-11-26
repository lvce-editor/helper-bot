import { test, expect } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFetch } from '../src/parts/CreateMockFetch/CreateMockFetch.ts'
import { computeNewDockerfileContent } from '../src/parts/ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'

const mockExec = createMockExec()
const mockFetch = createMockFetch([
  { version: 'v20.0.0', lts: 'Iron' },
  { version: 'v19.0.0', lts: false },
  { version: 'v18.0.0', lts: 'Hydrogen' },
])

test('updates node version in Dockerfile', async () => {
  const content = `FROM node:18.0.0
WORKDIR /app
COPY . .
RUN npm install`

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.writeFile(join(tempDir, 'Dockerfile'), content)

    const result = await computeNewDockerfileContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
      exec: mockExec,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toHaveLength(1)
    expect(result.changedFiles[0].path).toBe('Dockerfile')
    expect(result.changedFiles[0].content).toContain('node:20.0.0')
    expect(result.changedFiles[0].content).not.toContain('node:18.0.0')
    expect(result.pullRequestTitle).toBe(
      'ci: update Node.js to version v20.0.0',
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('returns same content when no node version found', async () => {
  const content = `FROM alpine:latest
WORKDIR /app
COPY . .`

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.writeFile(join(tempDir, 'Dockerfile'), content)

    const result = await computeNewDockerfileContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
      exec: mockExec,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('handles missing Dockerfile', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    const result = await computeNewDockerfileContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
      exec: mockExec,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
