import { test, expect, jest } from '@jest/globals'
import { removeNpmTokenMigration } from '../src/migrations/removeNpmToken.ts'

const encode = (s: string): string => Buffer.from(s).toString('base64')

test('returns success message when release.yml does not exist', async () => {
  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn().mockRejectedValueOnce({ status: 404 }),
      },
    },
  }

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    message: 'release.yml not found',
  })
})

test('returns success message when NODE_AUTH_TOKEN is not found', async () => {
  const releaseWorkflow = {
    data: {
      content: encode(`name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04`),
      sha: 'sha-release',
    },
  }

  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn().mockResolvedValueOnce(releaseWorkflow),
      },
    },
  }

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    message: 'No NODE_AUTH_TOKEN found in release.yml',
  })
})

test('removes NODE_AUTH_TOKEN from release.yml and creates PR', async () => {
  const releaseWorkflow = {
    data: {
      content: encode(`name: release
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
        run: npm publish`),
      sha: 'sha-release',
    },
  }

  const getRefResp = { data: { object: { sha: 'base-sha' } } }

  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn().mockResolvedValueOnce(releaseWorkflow as any),
      },
      git: {
        // @ts-ignore
        getRef: jest.fn().mockResolvedValue(getRefResp),
        // @ts-ignore
        createRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        // @ts-ignore
        create: jest.fn().mockResolvedValue({ data: { number: 1, node_id: 'test-node-id' } }),
      },
    },
    repos: {
      // @ts-ignore
      createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    changedFiles: 1,
    newBranch: expect.stringMatching(/^remove-npm-token-/),
    message: 'NODE_AUTH_TOKEN removed from release.yml successfully',
  })

  expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    ref: 'heads/main',
  })

  expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    ref: expect.stringMatching(/^refs\/heads\/remove-npm-token-/),
    sha: 'base-sha',
  })

  expect(octokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    path: '.github/workflows/release.yml',
    message: 'ci: remove NODE_AUTH_TOKEN from release workflow',
    content: expect.any(String),
    branch: expect.stringMatching(/^remove-npm-token-/),
    sha: 'sha-release',
  })

  expect(octokit.rest.pulls.create).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    title: 'ci: remove NODE_AUTH_TOKEN from release workflow',
    head: expect.stringMatching(/^remove-npm-token-/),
    base: 'main',
  })

  expect(octokit.graphql).toHaveBeenCalledWith(expect.stringContaining('enablePullRequestAutoMerge'))
})

test('removes NODE_AUTH_TOKEN with different indentation', async () => {
  const releaseWorkflow = {
    data: {
      content: encode(`name: release
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
        run: npm publish`),
      sha: 'sha-release',
    },
  }

  const getRefResp = { data: { object: { sha: 'base-sha' } } }

  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn().mockResolvedValueOnce(releaseWorkflow as any),
      },
      git: {
        // @ts-ignore
        getRef: jest.fn().mockResolvedValue(getRefResp),
        // @ts-ignore
        createRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        // @ts-ignore
        create: jest.fn().mockResolvedValue({ data: { number: 1, node_id: 'test-node-id' } }),
      },
    },
    repos: {
      // @ts-ignore
      createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    changedFiles: 1,
    newBranch: expect.stringMatching(/^remove-npm-token-/),
    message: 'NODE_AUTH_TOKEN removed from release.yml successfully',
  })

  // Verify the content was updated correctly
  const updateCall = octokit.repos.createOrUpdateFileContents.mock.calls[0]
  const updatedContent = Buffer.from(updateCall[0].content, 'base64').toString()

  expect(updatedContent).not.toContain('NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}')
  expect(updatedContent).not.toContain('env:')
})

test('handles error when file is not a file', async () => {
  const releaseWorkflow = {
    data: {
      type: 'dir',
    },
  }

  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn().mockResolvedValueOnce(releaseWorkflow),
      },
    },
  }

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    message: 'release.yml is not a file',
  })
})

test('handles errors gracefully', async () => {
  const octokit: any = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn().mockRejectedValueOnce(new Error('API error')),
      },
    },
  }

  const result = await removeNpmTokenMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: false,
    error: 'API error',
  })
})
