import { test, expect } from '@jest/globals'
import { join } from 'node:path'
import { computeNewGitpodDockerfileContent } from '../src/parts/ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFetch } from '../src/parts/CreateMockFetch/CreateMockFetch.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'

const mockExec = createMockExec()
const mockFetch = createMockFetch([
  { lts: 'Iron', version: 'v20.0.0' },
  { lts: false, version: 'v19.0.0' },
  { lts: 'Hydrogen', version: 'v18.0.0' },
])

test('updates node version in gitpod dockerfile', async () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0 \\
 && nvm alias default 18.0.0`

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, '.gitpod.Dockerfile')]: content,
    },
  })

  const result = await computeNewGitpodDockerfileContent({
    clonedRepoPath,
    exec: mockExec,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.gitpod.Dockerfile')
  expect(result.changedFiles[0].content).toContain('nvm install 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm use 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm alias default 20.0.0')
  expect(result.changedFiles[0].content).not.toContain('18.0.0')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
  expect(result.branchName).toBe('feature/update-node-version')
  expect(result.commitMessage).toBe('ci: update Node.js to version v20.0.0')
})

test('handles missing .gitpod.Dockerfile', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()

  const result = await computeNewGitpodDockerfileContent({
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
