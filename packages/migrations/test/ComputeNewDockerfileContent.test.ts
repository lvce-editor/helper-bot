import { test, expect, jest } from '@jest/globals'

const mockExeca = {
  execa: jest.fn(),
}

const mockFs = {
  readFile: jest.fn(),
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}

jest.unstable_mockModule('execa', () => mockExeca)
jest.unstable_mockModule('node:fs/promises', () => mockFs)
jest.unstable_mockModule('node:os', () => ({
  tmpdir: () => '/test',
}))

const { computeNewDockerfileContent } = await import(
  '../src/parts/ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
)

test('updates node version in Dockerfile', async () => {
  const content = `FROM node:18.0.0
WORKDIR /app
COPY . .
RUN npm install`

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeNewDockerfileContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('Dockerfile')
  expect(result.changedFiles[0].content).toContain('node:20.0.0')
  expect(result.changedFiles[0].content).not.toContain('node:18.0.0')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('returns same content when no node version found', async () => {
  const content = `FROM alpine:latest
WORKDIR /app
COPY . .`

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeNewDockerfileContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles missing Dockerfile', async () => {
  const error = new Error('File not found')
  // @ts-ignore
  error.code = 'ENOENT'

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockRejectedValue(error)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeNewDockerfileContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
