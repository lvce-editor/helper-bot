import { expect, test } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { modernizeBranchProtection } from '../src/parts/ModernizeBranchProtection/ModernizeBranchProtection.ts'

test('successfully migrates from classic to ruleset', async (): Promise<void> => {
  const fetchUrls: string[] = []
  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'
    fetchUrls.push(`${method} ${url}`)

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
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
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      return Response.json(
        {
          id: 456,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
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
  expect(fetchUrls).toContain('GET https://api.github.com/repos/test-owner/test-repo/branches/main/protection')
  expect(fetchUrls).toContain('GET https://api.github.com/repos/test-owner/test-repo/rulesets?includes_parents=false')
  expect(fetchUrls).toContain('POST https://api.github.com/repos/test-owner/test-repo/rulesets')
  expect(fetchUrls).toContain('DELETE https://api.github.com/repos/test-owner/test-repo/branches/main/protection')
})

test('returns success when no classic protection found', async (): Promise<void> => {
  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          message: 'Branch not protected',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        },
      )
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      message: 'No classic branch protection found',
      migrated: false,
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('returns success when ruleset already exists', async (): Promise<void> => {
  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json(
        [
          {
            enforcement: 'active',
            id: 123,
            name: 'Protect main',
            target: 'branch',
          },
        ],
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
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

test('returns error when creating ruleset fails', async (): Promise<void> => {
  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      return Response.json(
        {
          message: 'Validation failed',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 422,
        },
      )
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'CREATE_RULESET_FAILED',
    errorMessage: expect.stringContaining('Failed to create ruleset'),
    pullRequestTitle: '',
    status: 'error',
  })
})

test('returns error when deleting classic protection fails', async (): Promise<void> => {
  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      return Response.json(
        {
          id: 789,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return Response.json(
        {
          message: 'Forbidden',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 403,
        },
      )
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'DELETE_CLASSIC_PROTECTION_FAILED',
    errorMessage: expect.stringContaining('Failed to delete classic branch protection'),
    pullRequestTitle: '',
    status: 'error',
  })
})

test('handles custom branch name', async (): Promise<void> => {
  const fetchUrls: string[] = []
  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'
    fetchUrls.push(url)

    if (url.includes('/branches/develop/protection') && method === 'GET') {
      return Response.json(
        {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: false,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      return Response.json(
        {
          id: 999,
          name: 'Protect develop',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/develop/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  const result = await modernizeBranchProtection({
    branch: 'develop',
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
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
  expect(fetchUrls.some((url) => url.includes('/branches/develop/protection'))).toBe(true)
})

test('converts linear history requirement', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_linear_history: {
            enabled: true,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      createdRuleset = JSON.parse(options.body as string)
      return Response.json(
        {
          id: 111,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.rules.some((rule: any) => rule.type === 'non_fast_forward')).toBe(true)
})

test('converts force push protection', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          allow_force_pushes: {
            enabled: false,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      createdRuleset = JSON.parse(options.body as string)
      return Response.json(
        {
          id: 222,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.rules.some((rule: any) => rule.type === 'update')).toBe(true)
})

test('converts deletion protection', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          allow_deletions: {
            enabled: false,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      createdRuleset = JSON.parse(options.body as string)
      return Response.json(
        {
          id: 333,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.rules.some((rule: any) => rule.type === 'deletion')).toBe(true)
})

test('converts pull request review requirements', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_conversation_resolution: {
            enabled: true,
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: true,
            required_approving_review_count: 3,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      createdRuleset = JSON.parse(options.body as string)
      return Response.json(
        {
          id: 444,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  const pullRequestRule = createdRuleset.rules.find((rule: any) => rule.type === 'pull_request')
  expect(pullRequestRule).toEqual({
    parameters: {
      dismiss_stale_reviews_on_push: true,
      require_code_owner_review: true,
      require_last_push_approval: false,
      required_approving_review_count: 3,
      required_review_thread_resolution: true,
    },
    type: 'pull_request',
  })
})

test('converts required status checks', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_status_checks: {
            contexts: ['ci/test', 'ci/lint', 'ci/build'],
            strict: true,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      createdRuleset = JSON.parse(options.body as string)
      return Response.json(
        {
          id: 555,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  const statusCheckRule = createdRuleset.rules.find((rule: any) => rule.type === 'required_status_checks')
  expect(statusCheckRule).toEqual({
    parameters: {
      required_status_checks: [{ context: 'ci/test' }, { context: 'ci/lint' }, { context: 'ci/build' }],
      strict_required_status_checks_policy: true,
    },
    type: 'required_status_checks',
  })
})

test('adds bypass actors when enforce_admins is disabled', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          enforce_admins: {
            enabled: false,
          },
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      createdRuleset = JSON.parse(options.body as string)
      return Response.json(
        {
          id: 666,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset.bypass_actors).toEqual([
    {
      actor_id: 5,
      actor_type: 'RepositoryRole',
      bypass_mode: 'always',
    },
  ])
})

test('includes authorization header in requests', async (): Promise<void> => {
  const authHeaders: string[] = []

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'
    const authHeader = options?.headers ? (options.headers as Record<string, string>)['Authorization'] : undefined
    if (authHeader) {
      authHeaders.push(authHeader)
    }

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: true,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      return Response.json(
        {
          id: 777,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'secret-token-123',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(authHeaders.length).toBeGreaterThan(0)
  expect(authHeaders.every((header) => header === 'Bearer secret-token-123')).toBe(true)
})

test('handles 403 error when fetching classic protection', async (): Promise<void> => {
  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          message: 'Forbidden',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 403,
        },
      )
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      message: expect.any(String),
      migrated: false,
    },
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('creates correct conditions for branch targeting', async (): Promise<void> => {
  let createdRuleset: any = null

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET'

    if (url.includes('/branches/main/protection') && method === 'GET') {
      return Response.json(
        {
          required_status_checks: {
            contexts: ['ci/test'],
            strict: false,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (url.includes('/rulesets') && method === 'GET') {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (url.includes('/rulesets') && method === 'POST') {
      createdRuleset = JSON.parse(options.body as string)
      return Response.json(
        {
          id: 888,
          name: 'Protect main',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      )
    }

    if (url.includes('/branches/main/protection') && method === 'DELETE') {
      return new Response(null, {
        status: 204,
      })
    }

    throw new Error(`Unexpected URL: ${method} ${url}`)
  }

  await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(createdRuleset).not.toBeNull()
  expect(createdRuleset).toEqual(
    expect.objectContaining({
      conditions: {
        ref_name: {
          exclude: [],
          include: ['refs/heads/main'],
        },
      },
      enforcement: 'active',
      target: 'branch',
    }),
  )
})
