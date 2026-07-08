import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import config from '../src/parts/UpdateCiVersions/config.json' with { type: 'json' }
import { updateCiVersions } from '../src/parts/UpdateCiVersions/UpdateCiVersions.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const defaultRepoCommands = [
  {
    branch: 'main',
    osVersions: config.latestVersions,
    type: 'update-branch-protection-checks',
  },
]

test('updates Ubuntu, macOS, and Windows runner versions in ci.yml', async () => {
  const oldCiYml = `name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v3
      - run: npm test

  test-windows:
    runs-on: windows-2022
    steps:
      - uses: actions/checkout@v3
      - run: npm test

  test-macos:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v3
      - run: npm test
`

  const expectedCiYml = `name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v3
      - run: npm test

  test-windows:
    runs-on: windows-2025
    steps:
      - uses: actions/checkout@v3
      - run: npm test

  test-macos:
    runs-on: macos-26
    steps:
      - uses: actions/checkout@v3
      - run: npm test
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('ci.yml', workflowsUri)]: oldCiYml,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-ci-versions',
    changedFiles: [
      {
        content: expectedCiYml,
        path: '.github/workflows/ci.yml',
      },
    ],
    commitMessage: 'feature: update runner versions',
    pullRequestTitle: 'feature: update runner versions',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 201,
  })
})

test('updates multiple target workflow files', async () => {
  const oldPrYml = `name: PR

on: pull_request

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - run: npm test
`

  const oldReleaseYml = `name: Release

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-22.04
    steps:
      - run: npm publish
`

  const oldNightlyYaml = `name: Nightly

on:
  schedule:
    - cron: '0 0 * * *'

jobs:
  test:
    runs-on: macos-15
    steps:
      - run: npm test
`

  const expectedPrYml = `name: PR

on: pull_request

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - run: npm test
`

  const expectedReleaseYml = `name: Release

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-24.04
    steps:
      - run: npm publish
`

  const expectedNightlyYaml = `name: Nightly

on:
  schedule:
    - cron: '0 0 * * *'

jobs:
  test:
    runs-on: macos-26
    steps:
      - run: npm test
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('nightly.yaml', workflowsUri)]: oldNightlyYaml,
      [resolveUri('pr.yml', workflowsUri)]: oldPrYml,
      [resolveUri('release.yml', workflowsUri)]: oldReleaseYml,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-ci-versions',
    changedFiles: [
      {
        content: expectedNightlyYaml,
        path: '.github/workflows/nightly.yaml',
      },
      {
        content: expectedPrYml,
        path: '.github/workflows/pr.yml',
      },
      {
        content: expectedReleaseYml,
        path: '.github/workflows/release.yml',
      },
    ],
    commitMessage: 'feature: update runner versions',
    pullRequestTitle: 'feature: update runner versions',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 201,
  })
})

test('updates any workflow yml file', async () => {
  const otherYml = `name: Other

on: push

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - run: npm test
`

  const expectedOtherYml = `name: Other

on: push

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - run: npm test
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('other.yml', workflowsUri)]: otherYml,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-ci-versions',
    changedFiles: [
      {
        content: expectedOtherYml,
        path: '.github/workflows/other.yml',
      },
    ],
    commitMessage: 'feature: update runner versions',
    pullRequestTitle: 'feature: update runner versions',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 201,
  })
})

test('skips non-workflow files', async () => {
  const txtContent = `runs-on: ubuntu-22.04
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('notes.txt', workflowsUri)]: txtContent,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 200,
  })
})

test('returns empty result when no workflows directory exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 200,
  })
})

test('returns empty result when target files already have latest versions', async () => {
  const modernCiYml = `name: CI

on: push

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - run: npm test
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('ci.yml', workflowsUri)]: modernCiYml,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 200,
  })
})

test('updates older versions (ubuntu-20.04, macos-13, windows-2019)', async () => {
  const oldCiYml = `name: CI

on: push

jobs:
  test-ubuntu:
    runs-on: ubuntu-20.04
  test-macos:
    runs-on: macos-13
  test-windows:
    runs-on: windows-2019
`

  const expectedCiYml = `name: CI

on: push

jobs:
  test-ubuntu:
    runs-on: ubuntu-24.04
  test-macos:
    runs-on: macos-26
  test-windows:
    runs-on: windows-2025
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('ci.yml', workflowsUri)]: oldCiYml,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-ci-versions',
    changedFiles: [
      {
        content: expectedCiYml,
        path: '.github/workflows/ci.yml',
      },
    ],
    commitMessage: 'feature: update runner versions',
    pullRequestTitle: 'feature: update runner versions',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 201,
  })
})

test('uses versions from config.json', async () => {
  const oldCiYml = `name: CI

on: push

jobs:
  test:
    runs-on: ubuntu-22.04
`

  const expectedCiYml = `name: CI

on: push

jobs:
  test:
    runs-on: ubuntu-${config.latestVersions.ubuntu}
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('ci.yml', workflowsUri)]: oldCiYml,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-ci-versions',
    changedFiles: [
      {
        content: expectedCiYml,
        path: '.github/workflows/ci.yml',
      },
    ],
    commitMessage: 'feature: update runner versions',
    pullRequestTitle: 'feature: update runner versions',
    repoCommands: defaultRepoCommands,
    status: 'success',
    statusCode: 201,
  })

  // Verify the config values are being used
  expect(config.latestVersions.ubuntu).toBeDefined()
  expect(config.latestVersions.macos).toBeDefined()
  expect(config.latestVersions.windows).toBeDefined()
  expect(result.changedFiles[0].content).toContain(`ubuntu-${config.latestVersions.ubuntu}`)
})

test('uses branch option for branch protection repo command', async () => {
  const modernCiYml = `name: CI

on: push

jobs:
  test:
    runs-on: ubuntu-24.04
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = resolveUri('.github/workflows/', clonedRepoUri + '/')
  const mockFs = createMockFs({
    files: {
      [resolveUri('ci.yml', workflowsUri)]: modernCiYml,
    },
  })

  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await updateCiVersions({
    branch: 'develop',
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    repoCommands: [
      {
        branch: 'develop',
        osVersions: config.latestVersions,
        type: 'update-branch-protection-checks',
      },
    ],
    status: 'success',
    statusCode: 200,
  })
})
