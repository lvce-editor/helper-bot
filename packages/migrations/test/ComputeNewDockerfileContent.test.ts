import { test, expect } from '@jest/globals'
import { computeNewDockerfileContent } from '../src/parts/ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'

test('updates node version in Dockerfile', () => {
  const content = `FROM node:18.0.0
WORKDIR /app
COPY . .
RUN npm install`

  const result = computeNewDockerfileContent({
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toContain('node:20.0.0')
  expect(result.newContent).not.toContain('node:18.0.0')
})

test('updates multiple node version occurrences', () => {
  const content = `FROM node:18.0.0
WORKDIR /app
RUN echo "Using node:18.0.0"
COPY . .`

  const result = computeNewDockerfileContent({
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toContain('node:20.0.0')
  expect(result.newContent).not.toContain('node:18.0.0')
  const matches = result.newContent.match(/node:20\.0\.0/g)
  expect(matches?.length).toBe(2)
})

test('handles version without v prefix', () => {
  const content = `FROM node:18.0.0
WORKDIR /app`

  const result = computeNewDockerfileContent({
    currentContent: content,
    newVersion: '20.0.0',
  })

  expect(result.newContent).toContain('node:20.0.0')
})

test('returns same content when no node version found', () => {
  const content = `FROM alpine:latest
WORKDIR /app
COPY . .`

  const result = computeNewDockerfileContent({
    currentContent: content,
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe(content)
})

test('handles empty content', () => {
  const result = computeNewDockerfileContent({
    currentContent: '',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('')
})
