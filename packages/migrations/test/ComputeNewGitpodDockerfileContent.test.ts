import { test, expect } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeNewGitpodDockerfileContent } from '../src/parts/ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'

test('updates node version in gitpod dockerfile', async () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0 \\
 && nvm alias default 18.0.0`

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
    await FsPromises.writeFile(join(tempDir, '.gitpod.Dockerfile'), content)

    const result = await computeNewGitpodDockerfileContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
      exec: execa,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toHaveLength(1)
    expect(result.changedFiles[0].path).toBe('.gitpod.Dockerfile')
    expect(result.changedFiles[0].content).toContain('nvm install 20.0.0')
    expect(result.changedFiles[0].content).toContain('nvm use 20.0.0')
    expect(result.changedFiles[0].content).toContain('nvm alias default 20.0.0')
    expect(result.changedFiles[0].content).not.toContain('18.0.0')
    expect(result.pullRequestTitle).toBe(
      'ci: update Node.js to version v20.0.0',
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('handles missing .gitpod.Dockerfile', async () => {
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
    const result = await computeNewGitpodDockerfileContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
      exec: execa,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
