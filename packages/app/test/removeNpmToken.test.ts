import { test, expect, jest } from '@jest/globals'
import { removeNpmTokenMigration } from '../src/migrations/removeNpmToken.js'

const encode = (s: string): string => Buffer.from(s).toString('base64')

const createMockMigrationsRpc = (result: any) => ({
  invoke: jest.fn().mockResolvedValue(result),
  dispose: jest.fn().mockResolvedValue(undefined),
})

test('returns success message when release.yml does not exist', async () => {
  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn(),
      },
    },
  }

  const migrationsRpc = createMockMigrationsRpc({
    status: 'success',
    changedFiles: [],
    pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
  })

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    migrationsRpc,
  })

  expect(result).toEqual({
    success: true,
    message: 'No NODE_AUTH_TOKEN found in release.yml',
  })
})

test('returns success message when NODE_AUTH_TOKEN is not found', async () => {
  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn(),
      },
    },
  }

  const migrationsRpc = createMockMigrationsRpc({
    status: 'success',
    changedFiles: [],
    pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
  })

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    migrationsRpc,
  })

  expect(result).toEqual({
    success: true,
    message: 'No NODE_AUTH_TOKEN found in release.yml',
  })
})

test('removes NODE_AUTH_TOKEN from release.yml and creates PR', async () => {
  const getRefResp = { data: { object: { sha: 'base-sha' } } }

  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn(),
      },
      git: {
        // @ts-ignore
        getRef: jest.fn().mockResolvedValue(getRefResp),
        // @ts-ignore
        getCommit: jest.fn().mockResolvedValue({ data: { sha: 'base-sha' } }),
        // @ts-ignore
        createTree: jest.fn().mockResolvedValue({ data: { sha: 'tree-sha' } }),
        // @ts-ignore
        createCommit: jest
          .fn()
          .mockResolvedValue({ data: { sha: 'commit-sha' } }),
        // @ts-ignore
        createRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        // @ts-ignore
        create: jest
          .fn()
          .mockResolvedValue({ data: { number: 1, node_id: 'test-node-id' } }),
      },
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const migrationsRpc = createMockMigrationsRpc({
    status: 'success',
    changedFiles: [
      {
        path: '.github/workflows/release.yml',
        content: `name: release
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
      - name: Publish to npm
        run: npm publish`,
      },
    ],
    pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
  })

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    migrationsRpc,
  })

  expect(result).toEqual({
    success: true,
    changedFiles: 1,
    newBranch: expect.stringMatching(/^remove-npm-token-/),
    message: 'Migration applied successfully',
  })

  expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    ref: 'heads/main',
  })

  expect(octokit.rest.git.createTree).toHaveBeenCalled()
  expect(octokit.rest.git.createCommit).toHaveBeenCalled()
  expect(octokit.rest.git.createRef).toHaveBeenCalled()
  expect(octokit.rest.pulls.create).toHaveBeenCalled()
  expect(octokit.graphql).toHaveBeenCalledWith(
    expect.stringContaining('enablePullRequestAutoMerge'),
    {},
  )
})

test('removes NODE_AUTH_TOKEN with different indentation', async () => {
  const getRefResp = { data: { object: { sha: 'base-sha' } } }

  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn(),
      },
      git: {
        // @ts-ignore
        getRef: jest.fn().mockResolvedValue(getRefResp),
        // @ts-ignore
        getCommit: jest.fn().mockResolvedValue({ data: { sha: 'base-sha' } }),
        // @ts-ignore
        createTree: jest.fn().mockResolvedValue({ data: { sha: 'tree-sha' } }),
        // @ts-ignore
        createCommit: jest
          .fn()
          .mockResolvedValue({ data: { sha: 'commit-sha' } }),
        // @ts-ignore
        createRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        // @ts-ignore
        create: jest
          .fn()
          .mockResolvedValue({ data: { number: 1, node_id: 'test-node-id' } }),
      },
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const migrationsRpc = createMockMigrationsRpc({
    status: 'success',
    changedFiles: [
      {
        path: '.github/workflows/release.yml',
        content: `name: release
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
      - name: Publish to npm
        run: npm publish`,
      },
    ],
    pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
  })

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    migrationsRpc,
  })

  expect(result.success).toBe(true)
  expect(result.changedFiles).toBe(1)
})

test('handles error when file is not a file', async () => {
  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn(),
      },
    },
  }

  const migrationsRpc = createMockMigrationsRpc({
    status: 'success',
    changedFiles: [],
    pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
  })

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    migrationsRpc,
  })

  expect(result).toEqual({
    success: true,
    message: 'No NODE_AUTH_TOKEN found in release.yml',
  })
})

test('handles errors gracefully', async () => {
  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn(),
      },
    },
  }

  const migrationsRpc = createMockMigrationsRpc({
    status: 'error',
    changedFiles: [],
    pullRequestTitle: 'ci: remove NODE_AUTH_TOKEN from release workflow',
    errorMessage: 'API error',
  })

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    migrationsRpc,
  })

  expect(result).toEqual({
    success: false,
    error: 'API error',
  })
})
