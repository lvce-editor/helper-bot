import { test, expect } from '@jest/globals'
import { join } from 'node:path'
import { addOidcPermissionsToWorkflow } from '../src/parts/AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'

const mockExec = createMockExec()

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

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, '.github/workflows/release.yml')]: content,
    },
  })

  const result = await addOidcPermissionsToWorkflow({
    clonedRepoPath,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
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

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, '.github/workflows/release.yml')]: content,
    },
  })

  const result = await addOidcPermissionsToWorkflow({
    clonedRepoPath,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
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
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()

  const result = await addOidcPermissionsToWorkflow({
    clonedRepoPath,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
