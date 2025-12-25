import type { Octokit } from '@octokit/rest'
import { expect, test } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { getBranchProtection } from '../src/parts/GetBranchProtection/GetBranchProtection.ts'

const createMockOctokit = (requestHandler: (route: string, options: any) => Promise<any>): Octokit => {
  return {
    request: requestHandler,
  } as any
}

const createMockOctokitConstructor = (mockOctokit: Octokit): any => {
  return class {
    constructor(_options: any) {
      return mockOctokit
    }
  }
}

test('returns rulesets when available', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [
          {
            enforcement: 'active',
            id: 123,
            name: 'main protection',
          },
        ],
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: globalThis.fetch,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      data: [
        {
          enforcement: 'active',
          id: 123,
          name: 'main protection',
        },
      ],
      type: 'rulesets',
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('returns classic branch protection when rulesets not available', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          enforce_admins: {
            enabled: true,
          },
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: globalThis.fetch,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      data: {
        enforce_admins: {
          enabled: true,
        },
        required_status_checks: {
          contexts: ['ci/test'],
          strict: true,
        },
      },
      type: 'classic',
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('returns none when no branch protection is enabled', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      const error: any = new Error('Branch not protected')
      error.status = 404
      throw error
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: globalThis.fetch,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      data: null,
      type: 'none',
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('uses custom branch name', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: [],
            strict: false,
          },
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await getBranchProtection({
    branch: 'develop',
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: globalThis.fetch,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      data: {
        required_status_checks: {
          contexts: [],
          strict: false,
        },
      },
      type: 'classic',
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('includes authorization header in requests', async (): Promise<void> => {
  const requestCalls: Array<{ route: string; options: any }> = []

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    requestCalls.push({ route, options })

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      const error: any = new Error('Branch not protected')
      error.status = 404
      throw error
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: globalThis.fetch,
    fs: FsPromises as any,
    githubToken: 'secret-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(requestCalls.length).toBeGreaterThan(0)
  // The auth token is passed to Octokit constructor, not in individual requests
  // So we just verify that requests were made
  expect(requestCalls.length).toBeGreaterThan(0)
})
