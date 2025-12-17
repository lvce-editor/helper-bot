import { expect, test } from '@jest/globals'
import { getBranchProtection } from '../src/parts/GetBranchProtection/GetBranchProtection.ts'

test('returns rulesets when available', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return new Response(
        JSON.stringify([
          {
            id: 123,
            name: 'main protection',
            enforcement: 'active',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  globalThis.fetch = mockFetch as any

  const result = await getBranchProtection({
    repositoryOwner: 'test-owner',
    repositoryName: 'test-repo',
    githubToken: 'test-token',
  })

  expect(result.type).toBe('rulesets')
  expect(Array.isArray(result.data)).toBe(true)
  expect(result.data.length).toBe(1)
  expect(result.data[0].name).toBe('main protection')
})

test('returns classic branch protection when rulesets not available', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/branches/main/protection')) {
      return new Response(
        JSON.stringify({
          required_status_checks: {
            strict: true,
            contexts: ['ci/test'],
          },
          enforce_admins: {
            enabled: true,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  globalThis.fetch = mockFetch as any

  const result = await getBranchProtection({
    repositoryOwner: 'test-owner',
    repositoryName: 'test-repo',
    githubToken: 'test-token',
  })

  expect(result.type).toBe('classic')
  expect(result.data.required_status_checks).toBeDefined()
  expect(result.data.required_status_checks.contexts).toContain('ci/test')
})

test('returns none when no branch protection is enabled', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/branches/main/protection')) {
      return new Response(
        JSON.stringify({
          message: 'Branch not protected',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  globalThis.fetch = mockFetch as any

  const result = await getBranchProtection({
    repositoryOwner: 'test-owner',
    repositoryName: 'test-repo',
    githubToken: 'test-token',
  })

  expect(result.type).toBe('none')
  expect(result.data).toBe(null)
})

test('uses custom branch name', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/branches/develop/protection')) {
      return new Response(
        JSON.stringify({
          required_status_checks: {
            strict: false,
            contexts: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  globalThis.fetch = mockFetch as any

  const result = await getBranchProtection({
    repositoryOwner: 'test-owner',
    repositoryName: 'test-repo',
    branch: 'develop',
    githubToken: 'test-token',
  })

  expect(result.type).toBe('classic')
  expect(result.data.required_status_checks).toBeDefined()
})

test('includes authorization header in requests', async (): Promise<void> => {
  const fetchCalls: string[] = []

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const authHeader = options?.headers ? (options.headers as Record<string, string>)['Authorization'] : undefined
    fetchCalls.push(authHeader || 'no-auth')

    if (url.includes('/rulesets')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/branches/main/protection')) {
      return new Response(
        JSON.stringify({
          message: 'Branch not protected',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  globalThis.fetch = mockFetch as any

  await getBranchProtection({
    repositoryOwner: 'test-owner',
    repositoryName: 'test-repo',
    githubToken: 'secret-token',
  })

  expect(fetchCalls.every((call) => call === 'Bearer secret-token')).toBe(true)
  expect(fetchCalls.length).toBeGreaterThan(0)
})
