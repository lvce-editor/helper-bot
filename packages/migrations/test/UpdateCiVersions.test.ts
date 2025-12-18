import { test, expect } from '@jest/globals'
import { updateCiVersions } from '../src/parts/UpdateCiVersions/UpdateCiVersions.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

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
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v3
      - run: npm test
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = new URL('.github/workflows/', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [new URL('ci.yml', workflowsUri).toString()]: oldCiYml,
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
    commitMessage: 'ci: update CI runner versions',
    pullRequestTitle: 'ci: update CI runner versions',
    status: 'success',
    statusCode: 200,
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

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = new URL('.github/workflows/', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [new URL('pr.yml', workflowsUri).toString()]: oldPrYml,
      [new URL('release.yml', workflowsUri).toString()]: oldReleaseYml,
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
        content: expectedPrYml,
        path: '.github/workflows/pr.yml',
      },
      {
        content: expectedReleaseYml,
        path: '.github/workflows/release.yml',
      },
    ],
    commitMessage: 'ci: update CI runner versions',
    pullRequestTitle: 'ci: update CI runner versions',
    status: 'success',
    statusCode: 200,
  })
})

test('skips non-target workflow files', async () => {
  const otherYml = `name: Other

on: push

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - run: npm test
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = new URL('.github/workflows/', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [new URL('other.yml', workflowsUri).toString()]: otherYml,
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
  const workflowsUri = new URL('.github/workflows/', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [new URL('ci.yml', workflowsUri).toString()]: modernCiYml,
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
    runs-on: macos-15
  test-windows:
    runs-on: windows-2025
`

  const clonedRepoUri = pathToUri('/test/repo')
  const workflowsUri = new URL('.github/workflows/', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [new URL('ci.yml', workflowsUri).toString()]: oldCiYml,
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
    commitMessage: 'ci: update CI runner versions',
    pullRequestTitle: 'ci: update CI runner versions',
    status: 'success',
    statusCode: 200,
  })
})

