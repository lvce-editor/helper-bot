import { test, expect } from '@jest/globals'
import { computeNewGitpodDockerfileContent } from '../src/parts/ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'

test('updates node version in gitpod dockerfile', () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0 \\
 && nvm alias default 18.0.0`

  const result = computeNewGitpodDockerfileContent({
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toContain('nvm install 20.0.0')
  expect(result.newContent).toContain('nvm use 20.0.0')
  expect(result.newContent).toContain('nvm alias default 20.0.0')
  expect(result.newContent).not.toContain('18.0.0')
})

test('updates multiple nvm commands', () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 22.9.0 \\
 && nvm alias default 22.9.0`

  const result = computeNewGitpodDockerfileContent({
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toContain('nvm install 20.0.0')
  expect(result.newContent).toContain('nvm use 20.0.0')
  expect(result.newContent).toContain('nvm alias default 20.0.0')
})

test('handles version without v prefix', () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0`

  const result = computeNewGitpodDockerfileContent({
    currentContent: content,
    newVersion: '20.0.0',
  })

  expect(result.newContent).toContain('nvm install 20.0.0')
  expect(result.newContent).toContain('nvm use 20.0.0')
})

test('returns same content when no nvm commands found', () => {
  const content = `FROM gitpod/workspace-full
WORKDIR /workspace
COPY . .`

  const result = computeNewGitpodDockerfileContent({
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe(content)
})

test('handles empty content', () => {
  const result = computeNewGitpodDockerfileContent({
    currentContent: '',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('')
})
