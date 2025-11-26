import { test, expect } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addOidcPermissionsToWorkflow } from '../src/parts/AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'

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

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.mkdir(join(tempDir, '.github/workflows'), {
      recursive: true,
    })
    await FsPromises.writeFile(
      join(tempDir, '.github/workflows/release.yml'),
      content,
    )

    const result = await addOidcPermissionsToWorkflow({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
    expect(result.pullRequestTitle).toBe(
      'feature: update permissions for open id connect publishing',
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
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

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.mkdir(join(tempDir, '.github/workflows'), {
      recursive: true,
    })
    await FsPromises.writeFile(
      join(tempDir, '.github/workflows/release.yml'),
      content,
    )

    const result = await addOidcPermissionsToWorkflow({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
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
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('handles missing release.yml file', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    const result = await addOidcPermissionsToWorkflow({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
