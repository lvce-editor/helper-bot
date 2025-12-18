import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { runLintInCi } from '../src/parts/RunLintInCi/RunLintInCi.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('adds lint step after type-check in pr.yml', async () => {
  const content = `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run type-check
      - run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm test`,
        path: '.github/workflows/pr.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 201,
  })
})

test('adds lint step after npm test when type-check is not found', async () => {
  const content = `name: CI
on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/ci.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: CI
on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint`,
        path: '.github/workflows/ci.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 201,
  })
})

test('adds lint step after npm run build when type-check and test are not found', async () => {
  const content = `name: Release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  release:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm publish`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/release.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: Release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  release:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm publish`,
        path: '.github/workflows/release.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 201,
  })
})

test('returns error when no suitable location found', async () => {
  const content = `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'RUN_LINT_IN_CI_FAILED',
    errorMessage: 'pr.yml: No suitable location found to add lint step. Expected to find one of: npm run type-check, npm test, or npm run build',
    status: 'error',
    statusCode: 424,
  })
})

test('returns empty result when lint step already exists', async () => {
  const content = `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
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

test('handles missing workflow files', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await runLintInCi({
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

test('processes multiple workflow files', async () => {
  const prContent = `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run type-check`

  const ciContent = `name: CI
on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/ci.yml', clonedRepoUri).toString()]: ciContent,
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: prContent,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint`,
        path: '.github/workflows/pr.yml',
      },
      {
        content: `name: CI
on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint`,
        path: '.github/workflows/ci.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 201,
  })
})

test('preserves indentation when adding lint step', async () => {
  const content = `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run type-check
      - run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm test`,
        path: '.github/workflows/pr.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 201,
  })
})

test('handles workflow with different indentation styles', async () => {
  const content = `name: CI
on: [push]
jobs:
  test:
    steps:
    - uses: actions/checkout@v4
    - run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/ci.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: CI
on: [push]
jobs:
  test:
    steps:
    - uses: actions/checkout@v4
    - run: npm test
    - run: npm run lint`,
        path: '.github/workflows/ci.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 200,
  })
})

test('skips files with errors and processes others', async () => {
  const prContent = `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci`

  const ciContent = `name: CI
on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/ci.yml', clonedRepoUri).toString()]: ciContent,
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: prContent,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'RUN_LINT_IN_CI_FAILED',
    errorMessage: 'pr.yml: No suitable location found to add lint step. Expected to find one of: npm run type-check, npm test, or npm run build',
    status: 'error',
    statusCode: 424,
  })
})

test('handles all three workflow files', async () => {
  const prContent = `name: PR
jobs:
  test:
    steps:
      - run: npm run type-check`

  const ciContent = `name: CI
jobs:
  test:
    steps:
      - run: npm test`

  const releaseContent = `name: Release
jobs:
  release:
    steps:
      - run: npm run build`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/ci.yml', clonedRepoUri).toString()]: ciContent,
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: prContent,
      [new URL('.github/workflows/release.yml', clonedRepoUri).toString()]: releaseContent,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: PR
jobs:
  test:
    steps:
      - run: npm run type-check
      - run: npm run lint`,
        path: '.github/workflows/pr.yml',
      },
      {
        content: `name: CI
jobs:
  test:
    steps:
      - run: npm test
      - run: npm run lint`,
        path: '.github/workflows/ci.yml',
      },
      {
        content: `name: Release
jobs:
  release:
    steps:
      - run: npm run build
      - run: npm run lint`,
        path: '.github/workflows/release.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 200,
  })
})

test('handles workflow with no indentation', async () => {
  const content = `name: CI
jobs:
test:
steps:
- run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/ci.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: CI
jobs:
test:
steps:
- run: npm test
- run: npm run lint`,
        path: '.github/workflows/ci.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 200,
  })
})

test('returns empty result when one file has lint and others do not exist', async () => {
  const content = `name: PR
on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
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

test('handles type-check with different spacing', async () => {
  const content = `name: PR
jobs:
  test:
    steps:
      - run:   npm run type-check
      - run: npm test`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.github/workflows/pr.yml', clonedRepoUri).toString()]: content,
    },
  })

  const result = await runLintInCi({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'ci/add-lint-step',
    changedFiles: [
      {
        content: `name: PR
jobs:
  test:
    steps:
      - run:   npm run type-check
      - run: npm run lint
      - run: npm test`,
        path: '.github/workflows/pr.yml',
      },
    ],
    commitMessage: 'ci: add lint step to workflows',
    pullRequestTitle: 'ci: add lint step to workflows',
    status: 'success',
    statusCode: 200,
  })
})
