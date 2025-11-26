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

const { removeNpmTokenFromWorkflow } = await import(
  '../src/parts/RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
)

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

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await removeNpmTokenFromWorkflow({
    repositoryOwner: 'test',
    repositoryName: 'repo',
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

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await removeNpmTokenFromWorkflow({
    repositoryOwner: 'test',
    repositoryName: 'repo',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe(
    'ci: remove NODE_AUTH_TOKEN from release workflow',
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

  const result = await removeNpmTokenFromWorkflow({
    repositoryOwner: 'test',
    repositoryName: 'repo',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
