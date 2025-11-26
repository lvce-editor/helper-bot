import { test, expect } from '@jest/globals'
import { addOidcPermissionsToWorkflow } from '../src/parts/AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'

test('returns same content when permissions already exist', () => {
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

  const result = addOidcPermissionsToWorkflow({ content })

  expect(result.updatedContent).toBe(content)
})

test('adds permissions before jobs section', () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04`

  const result = addOidcPermissionsToWorkflow({ content })

  expect(result.updatedContent).toContain('permissions:')
  expect(result.updatedContent).toContain('id-token: write # Required for OIDC')
  expect(result.updatedContent).toContain('contents: write')
  expect(result.updatedContent).toContain('jobs:')
  const jobsIndex = result.updatedContent.indexOf('jobs:')
  const permissionsIndex = result.updatedContent.indexOf('permissions:')
  expect(permissionsIndex).toBeLessThan(jobsIndex)
})

test('adds permissions at the end when no jobs section exists', () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'`

  const result = addOidcPermissionsToWorkflow({ content })

  expect(result.updatedContent).toContain('permissions:')
  expect(result.updatedContent).toContain('id-token: write # Required for OIDC')
  expect(result.updatedContent).toContain('contents: write')
  expect(result.updatedContent.endsWith('contents: write')).toBe(true)
})

test('handles empty content', () => {
  const content = ''

  const result = addOidcPermissionsToWorkflow({ content })

  expect(result.updatedContent).toContain('permissions:')
  expect(result.updatedContent).toContain('id-token: write # Required for OIDC')
  expect(result.updatedContent).toContain('contents: write')
})
