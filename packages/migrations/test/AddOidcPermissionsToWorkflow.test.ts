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

const { addOidcPermissionsToWorkflow } = await import(
  '../src/parts/AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
)

test('returns same content when permissions already exist', async () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

permissions:
  id-token: write # Required for OIDC
  contents: write

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04`

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await addOidcPermissionsToWorkflow({
    repositoryOwner: 'test',
    repositoryName: 'repo',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe(
    'feature: update permissions for open id connect publishing',
  )
})

test('adds permissions before jobs section', async () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04`

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await addOidcPermissionsToWorkflow({
    repositoryOwner: 'test',
    repositoryName: 'repo',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.github/workflows/release.yml')
  expect(result.changedFiles[0].content).toContain('permissions:')
  expect(result.changedFiles[0].content).toContain(
    'id-token: write # Required for OIDC',
  )
  expect(result.changedFiles[0].content).toContain('contents: write')
  expect(result.changedFiles[0].content).toContain('jobs:')
  const jobsIndex = result.changedFiles[0].content.indexOf('jobs:')
  const permissionsIndex =
    result.changedFiles[0].content.indexOf('permissions:')
  expect(permissionsIndex).toBeLessThan(jobsIndex)
  expect(result.pullRequestTitle).toBe(
    'feature: update permissions for open id connect publishing',
  )
})

test('handles missing release.yml file', async () => {
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

  const result = await addOidcPermissionsToWorkflow({
    repositoryOwner: 'test',
    repositoryName: 'repo',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
