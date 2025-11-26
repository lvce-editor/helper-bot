import { test, expect, jest } from '@jest/globals'
import { addOidcPermissionsMigration } from '../src/migrations/addOidcPermissions.js'

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

  const result = await addOidcPermissionsMigration.run({
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

test('returns success message when permissions already exist', async () => {
  const releaseWorkflow = {
    data: {
      content: encode(`name: release
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

  const result = await addOidcPermissionsMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    message: 'OIDC permissions already present in release.yml',
  })
})

test('adds OIDC permissions to release.yml and creates PR', async () => {
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
        create: jest
          .fn()
          .mockResolvedValue({ data: { number: 1, node_id: 'test-node-id' } }),
      },
    },
    repos: {
      // @ts-ignore
      createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const result = await addOidcPermissionsMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    changedFiles: 1,
    newBranch: expect.stringMatching(/^add-oidc-permissions-/),
    message: 'OIDC permissions added to release.yml successfully',
  })

  expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    ref: 'heads/main',
  })

  expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    ref: expect.stringMatching(/^refs\/heads\/add-oidc-permissions-/),
    sha: 'base-sha',
  })

  expect(octokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    path: '.github/workflows/release.yml',
    message: 'feature: update permissions for open id connect publishing',
    content: expect.any(String),
    branch: expect.stringMatching(/^add-oidc-permissions-/),
    sha: 'sha-release',
  })

  expect(octokit.rest.pulls.create).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    title: 'feature: update permissions for open id connect publishing',
    head: expect.stringMatching(/^add-oidc-permissions-/),
    base: 'main',
  })

  expect(octokit.graphql).toHaveBeenCalledWith(
    expect.stringContaining('enablePullRequestAutoMerge'),
  )
})

test('adds permissions at the end when no jobs section exists', async () => {
  const releaseWorkflow = {
    data: {
      content: encode(`name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'`),
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
        create: jest
          .fn()
          .mockResolvedValue({ data: { number: 1, node_id: 'test-node-id' } }),
      },
    },
    repos: {
      // @ts-ignore
      createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
    },
    // @ts-ignore
    graphql: jest.fn().mockResolvedValue({}),
  }

  const result = await addOidcPermissionsMigration.run({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
  })

  expect(result.success).toBe(true)
  expect(result.changedFiles).toBe(1)

  // Verify the content was updated correctly
  const updateCall = octokit.repos.createOrUpdateFileContents.mock.calls[0]
  const updatedContent = Buffer.from(updateCall[0].content, 'base64').toString()

  expect(updatedContent).toContain('permissions:')
  expect(updatedContent).toContain('id-token: write # Required for OIDC')
  expect(updatedContent).toContain('contents: write')
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

  const result = await addOidcPermissionsMigration.run({
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

  const result = await addOidcPermissionsMigration.run({
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
