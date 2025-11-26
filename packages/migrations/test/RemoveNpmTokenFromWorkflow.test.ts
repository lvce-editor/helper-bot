import { test, expect } from '@jest/globals'
import { removeNpmTokenFromWorkflow } from '../src/parts/RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'

test('removes NODE_AUTH_TOKEN from workflow', () => {
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

  const result = removeNpmTokenFromWorkflow({ content })

  expect(result.updatedContent).not.toContain(
    'NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}',
  )
  expect(result.updatedContent).toContain('Setup Node.js')
  expect(result.updatedContent).toContain('Publish to npm')
})

test('returns same content when NODE_AUTH_TOKEN is not found', () => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04`

  const result = removeNpmTokenFromWorkflow({ content })

  expect(result.updatedContent).toBe(content)
})

test('handles different indentation', () => {
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

  const result = removeNpmTokenFromWorkflow({ content })

  expect(result.updatedContent).not.toContain(
    'NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}',
  )
})

test('handles empty content', () => {
  const content = ''

  const result = removeNpmTokenFromWorkflow({ content })

  expect(result.updatedContent).toBe('')
})
