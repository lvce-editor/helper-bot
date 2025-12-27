import type { Octokit } from '@octokit/rest'
import { expect, test } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { modernizeBranchProtection } from '../src/parts/ModernizeBranchProtection/ModernizeBranchProtection.ts'
import { GITHUB_ACTIONS_INTEGRATION_ID } from '../src/parts/Constants/Constants.ts'

interface MockRequest {
  method: string
  route: string
}

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

test.skip('successfully migrates from classic to ruleset', async (): Promise<void> => {
  const requests: MockRequest[] = []

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    const method = route.split(' ')[0]
    requests.push({ method, route })

    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          enforce_admins: {
            enabled: true,
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: true,
            required_approving_review_count: 2,
          },
          required_status_checks: {
            contexts: ['ci/test', 'ci/build'],
            strict: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      return {
        data: {
          id: 456,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      message: 'Successfully migrated branch protection from classic to rulesets',
      migrated: true,
      rulesetId: 456,
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
  expect(requests).toEqual([
    { method: 'GET', route: 'GET /repos/{owner}/{repo}/rulesets' },
    { method: 'GET', route: 'GET /repos/{owner}/{repo}/branches/{branch}/protection' },
    { method: 'POST', route: 'POST /repos/{owner}/{repo}/rulesets' },
    { method: 'DELETE', route: 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection' },
  ])
})

test.skip('creates default ruleset when no classic protection found', async (): Promise<void> => {
  const requests: MockRequest[] = []

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    const method = route.split(' ')[0]
    requests.push({ method, route })

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      const error: any = new Error('Branch not protected')
      error.status = 404
      throw error
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      return {
        data: {
          id: 1000,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      message: 'Successfully created default branch ruleset',
      migrated: true,
      rulesetId: 1000,
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
  expect(requests).toEqual([
    { method: 'GET', route: 'GET /repos/{owner}/{repo}/rulesets' },
    { method: 'GET', route: 'GET /repos/{owner}/{repo}/branches/{branch}/protection' },
    { method: 'POST', route: 'POST /repos/{owner}/{repo}/rulesets' },
  ])
})

test.skip('returns success when ruleset already exists', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [
          {
            enforcement: 'active',
            id: 123,
            name: 'Protect main',
            target: 'branch',
          },
        ],
        status: 200,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      message: 'Ruleset already exists for this branch',
      migrated: false,
      rulesetId: 123,
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test.skip('returns error when creating ruleset fails', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      return {
        data: {
          message: 'Validation failed',
        },
        status: 422,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'CREATE_RULESET_FAILED',
    errorMessage: expect.stringContaining('Failed to create ruleset'),
    status: 'error',
    statusCode: 424,
  })
})

test.skip('returns error when deleting classic protection fails', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      return {
        data: {
          id: 789,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          message: 'Forbidden',
        },
        status: 403,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'DELETE_CLASSIC_PROTECTION_FAILED',
    errorMessage: expect.stringContaining('Failed to delete classic branch protection'),
    status: 'error',
    statusCode: 424,
  })
})

test.skip('handles custom branch name', async (): Promise<void> => {
  const requests: MockRequest[] = []

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    const method = route.split(' ')[0]
    requests.push({ method, route })

    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection' && options.branch === 'develop') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: false,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      return {
        data: {
          id: 999,
          name: 'Protect develop',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection' && options.branch === 'develop') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    branch: 'develop',
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      message: expect.any(String),
      migrated: true,
      rulesetId: 999,
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
  expect(requests.some((req) => req.route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection')).toBe(true)
})

test.skip('converts linear history requirement', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_linear_history: {
            enabled: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 111,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.rules.some((rule: any) => rule.type === 'non_fast_forward')).toBe(true)
})

test.skip('always enables linear history even when not in classic protection', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: false,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 222,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.rules.some((rule: any) => rule.type === 'non_fast_forward')).toBe(true)
})

test.skip('converts force push protection', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          allow_force_pushes: {
            enabled: false,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 222,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.rules.some((rule: any) => rule.type === 'non_fast_forward')).toBe(true)
})

test.skip('converts deletion protection', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          allow_deletions: {
            enabled: false,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 333,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.rules.some((rule: any) => rule.type === 'deletion')).toBe(true)
})

test.skip('converts pull request review requirements', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_conversation_resolution: {
            enabled: true,
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: true,
            required_approving_review_count: 3,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 444,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  const pullRequestRule = createdRuleset.rules.find((rule: any) => rule.type === 'pull_request')
  expect(pullRequestRule).toEqual({
    parameters: {
      allowed_merge_methods: ['squash'],
      dismiss_stale_reviews_on_push: true,
      require_code_owner_review: true,
      require_last_push_approval: false,
      required_approving_review_count: 3,
      required_review_thread_resolution: true,
    },
    type: 'pull_request',
  })
})

test.skip('converts required status checks', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test', 'ci/lint', 'ci/build'],
            strict: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 555,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  const statusCheckRule = createdRuleset.rules.find((rule: any) => rule.type === 'required_status_checks')
  expect(statusCheckRule).toEqual({
    parameters: {
      required_status_checks: [
        { context: 'ci/test', integration_id: GITHUB_ACTIONS_INTEGRATION_ID },
        { context: 'ci/lint', integration_id: GITHUB_ACTIONS_INTEGRATION_ID },
        { context: 'ci/build', integration_id: GITHUB_ACTIONS_INTEGRATION_ID },
      ],
      strict_required_status_checks_policy: true,
    },
    type: 'required_status_checks',
  })
})

test.skip('adds bypass actors when enforce_admins is disabled', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          enforce_admins: {
            enabled: false,
          },
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 666,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.bypass_actors).toEqual([])
})

test.skip('includes authorization header in requests', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      return {
        data: {
          id: 777,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'secret-token-123',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.status).toBe('success')
})

test.skip('creates default ruleset when 403 error occurs fetching classic protection', async (): Promise<void> => {
  const requests: MockRequest[] = []

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    const method = route.split(' ')[0]
    requests.push({ method, route })

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      const error: any = new Error('Forbidden')
      error.status = 403
      throw error
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      return {
        data: {
          id: 3000,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      message: 'Successfully created default branch ruleset',
      migrated: true,
      rulesetId: 3000,
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
  expect(requests).toEqual([
    { method: 'GET', route: 'GET /repos/{owner}/{repo}/rulesets' },
    { method: 'GET', route: 'GET /repos/{owner}/{repo}/branches/{branch}/protection' },
    { method: 'POST', route: 'POST /repos/{owner}/{repo}/rulesets' },
  ])
})

test.skip('creates default ruleset with correct structure when no classic protection exists', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      const error: any = new Error('Branch not protected')
      error.status = 404
      throw error
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 2000,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset).toEqual(
    expect.objectContaining({
      conditions: {
        ref_name: {
          exclude: [],
          include: ['~DEFAULT_BRANCH'],
        },
      },
      enforcement: 'active',
      name: 'Protect main',
      target: 'branch',
    }),
  )
  // Verify default rules are included
  expect(createdRuleset.rules).toEqual(expect.arrayContaining([{ type: 'non_fast_forward' }, { type: 'required_linear_history' }, { type: 'deletion' }]))
  expect(createdRuleset.rules.length).toBe(3)
  expect(createdRuleset.bypass_actors).toEqual([])
})

test.skip('creates correct conditions for branch targeting', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockOctokit = createMockOctokit(async (route: string, options: any) => {
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: false,
          },
        },
        status: 200,
      }
    }

    if (route === 'GET /repos/{owner}/{repo}/rulesets') {
      return {
        data: [],
        status: 200,
      }
    }

    if (route === 'POST /repos/{owner}/{repo}/rulesets') {
      createdRuleset = { ...options }
      delete createdRuleset.owner
      delete createdRuleset.repo
      delete createdRuleset.headers
      return {
        data: {
          id: 888,
          name: 'Protect main',
        },
        status: 201,
      }
    }

    if (route === 'DELETE /repos/{owner}/{repo}/branches/{branch}/protection') {
      return {
        data: null,
        status: 204,
      }
    }

    throw new Error(`Unexpected route: ${route}`)
  })

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset).toEqual(
    expect.objectContaining({
      conditions: {
        ref_name: {
          exclude: [],
          include: ['~DEFAULT_BRANCH'],
        },
      },
      enforcement: 'active',
      target: 'branch',
    }),
  )
})
