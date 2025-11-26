import { test, expect } from '@jest/globals'
import { removeNpmTokenFromWorkflow } from '../src/parts/RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'

test('removes NODE_AUTH_TOKEN from workflow', async () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
        env:
          NODE_AUTH_TOKEN: \${{secrets.NPM_TOKEN}}
      - name: Publish to npm
        run: npm publish`

  const result = await removeNpmTokenFromWorkflow({
    repository: 'test/repo',
    content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.github/workflows/release.yml')
  expect(result.changedFiles[0].content).not.toContain(
    'NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}',
  )
  expect(result.changedFiles[0].content).toContain('Setup Node.js')
  expect(result.changedFiles[0].content).toContain('Publish to npm')
  expect(result.pullRequestTitle).toBe(
    'ci: remove NODE_AUTH_TOKEN from release workflow',
  )
})

test('returns same content when NODE_AUTH_TOKEN is not found', async () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04`

  const result = await removeNpmTokenFromWorkflow({
    repository: 'test/repo',
    content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe(
    'ci: remove NODE_AUTH_TOKEN from release workflow',
  )
})

test('handles different indentation', async () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
        env:
          NODE_AUTH_TOKEN: \${{secrets.NPM_TOKEN}}
      - name: Publish to npm
        run: npm publish`

  const result = await removeNpmTokenFromWorkflow({
    repository: 'test/repo',
    content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).not.toContain(
    'NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}',
  )
})

test('handles empty content', async () => {
  const content = ''

  const result = await removeNpmTokenFromWorkflow({
    repository: 'test/repo',
    content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
