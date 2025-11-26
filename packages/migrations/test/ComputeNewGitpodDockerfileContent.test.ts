import { test, expect } from '@jest/globals'
import { computeNewGitpodDockerfileContent } from '../src/parts/ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'

test('updates node version in gitpod dockerfile', async () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0 \\
 && nvm alias default 18.0.0`

  const result = await computeNewGitpodDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.gitpod.Dockerfile')
  expect(result.changedFiles[0].content).toContain('nvm install 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm use 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm alias default 20.0.0')
  expect(result.changedFiles[0].content).not.toContain('18.0.0')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('updates multiple nvm commands', async () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 22.9.0 \\
 && nvm alias default 22.9.0`

  const result = await computeNewGitpodDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain('nvm install 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm use 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm alias default 20.0.0')
})

test('handles version without v prefix', async () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0`

  const result = await computeNewGitpodDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: '20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain('nvm install 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm use 20.0.0')
})

test('returns same content when no nvm commands found', async () => {
  const content = `FROM gitpod/workspace-full
WORKDIR /workspace
COPY . .`

  const result = await computeNewGitpodDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles empty content', async () => {
  const result = await computeNewGitpodDockerfileContent({
    repository: 'test/repo',
    currentContent: '',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
