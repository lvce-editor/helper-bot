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

const { computeNewNvmrcContent } = await import(
  '../src/parts/ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
)

test('computes new nvmrc content when version should be updated', async () => {
  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue('v18.0.0')
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeNewNvmrcContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.nvmrc')
  expect(result.changedFiles[0].content).toBe('v20.0.0\n')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('returns same content when existing version is newer', async () => {
  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue('v22.0.0')
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeNewNvmrcContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('handles missing .nvmrc file', async () => {
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

  const result = await computeNewNvmrcContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
