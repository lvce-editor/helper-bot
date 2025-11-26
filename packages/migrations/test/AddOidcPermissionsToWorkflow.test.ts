import { test, expect } from '@jest/globals'
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

  const result = await addOidcPermissionsToWorkflow({
    repository: 'test/repo',
    content,
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

  const result = await addOidcPermissionsToWorkflow({
    repository: 'test/repo',
    content,
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

test('adds permissions at the end when no jobs section exists', async () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'`

  const result = await addOidcPermissionsToWorkflow({
    repository: 'test/repo',
    content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain('permissions:')
  expect(result.changedFiles[0].content).toContain(
    'id-token: write # Required for OIDC',
  )
  expect(result.changedFiles[0].content).toContain('contents: write')
  expect(result.changedFiles[0].content.endsWith('contents: write')).toBe(true)
})

test('handles empty content', async () => {
  const content = ''

  const result = await addOidcPermissionsToWorkflow({
    repository: 'test/repo',
    content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain('permissions:')
  expect(result.changedFiles[0].content).toContain(
    'id-token: write # Required for OIDC',
  )
  expect(result.changedFiles[0].content).toContain('contents: write')
})
