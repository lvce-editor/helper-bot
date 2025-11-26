import { test, expect } from '@jest/globals'
import { computeNewDockerfileContent } from '../src/parts/ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'

test('updates node version in Dockerfile', async () => {
  const content = `FROM node:18.0.0
WORKDIR /app
COPY . .
RUN npm install`

  const result = await computeNewDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('Dockerfile')
  expect(result.changedFiles[0].content).toContain('node:20.0.0')
  expect(result.changedFiles[0].content).not.toContain('node:18.0.0')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('updates multiple node version occurrences', async () => {
  const content = `FROM node:18.0.0
WORKDIR /app
RUN echo "Using node:18.0.0"
COPY . .`

  const result = await computeNewDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain('node:20.0.0')
  expect(result.changedFiles[0].content).not.toContain('node:18.0.0')
  const matches = result.changedFiles[0].content.match(/node:20\.0\.0/g)
  expect(matches?.length).toBe(2)
})

test('handles version without v prefix', async () => {
  const content = `FROM node:18.0.0
WORKDIR /app`

  const result = await computeNewDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: '20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain('node:20.0.0')
})

test('returns same content when no node version found', async () => {
  const content = `FROM alpine:latest
WORKDIR /app
COPY . .`

  const result = await computeNewDockerfileContent({
    repository: 'test/repo',
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles empty content', async () => {
  const result = await computeNewDockerfileContent({
    repository: 'test/repo',
    currentContent: '',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
