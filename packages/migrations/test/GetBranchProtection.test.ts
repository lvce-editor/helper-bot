import { expect, test } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { getBranchProtection } from '../src/parts/GetBranchProtection/GetBranchProtection.ts'

test('returns rulesets when available', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return Response.json(
        [
          {
            enforcement: 'active',
            id: 123,
            name: 'main protection',
          },
        ],
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.status).toBe('success')
  expect(result).toHaveProperty('data')
  const successResult = result as Extract<typeof result, { status: 'success' }>
  expect(successResult.data.type).toBe('rulesets')
  expect(Array.isArray(successResult.data.data)).toBe(true)
  expect(successResult.data.data.length).toBe(1)
  expect(successResult.data.data[0].name).toBe('main protection')
  expect(successResult.changedFiles).toEqual([])
})

test('returns classic branch protection when rulesets not available', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    if (url.includes('/branches/main/protection')) {
      return Response.json(
        {
          enforce_admins: {
            enabled: true,
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
    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.status).toBe('success')
  expect(result).toHaveProperty('data')
  const successResult = result as Extract<typeof result, { status: 'success' }>
  expect(successResult.data.type).toBe('classic')
  expect(successResult.data.data.required_status_checks).toBeDefined()
  expect(successResult.data.data.required_status_checks.contexts).toContain('ci/test')
  expect(successResult.changedFiles).toEqual([])
})

test('returns none when no branch protection is enabled', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    if (url.includes('/branches/main/protection')) {
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
    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.status).toBe('success')
  expect(result).toHaveProperty('data')
  const successResult = result as Extract<typeof result, { status: 'success' }>
  expect(successResult.data.type).toBe('none')
  expect(successResult.data.data).toBe(null)
  expect(successResult.changedFiles).toEqual([])
})

test('uses custom branch name', async (): Promise<void> => {
  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes('/rulesets')) {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    if (url.includes('/branches/develop/protection')) {
      return Response.json(
        {
          required_status_checks: {
            contexts: [],
            strict: false,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await getBranchProtection({
    branch: 'develop',
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.status).toBe('success')
  expect(result).toHaveProperty('data')
  const successResult = result as Extract<typeof result, { status: 'success' }>
  expect(successResult.data.type).toBe('classic')
  expect(successResult.data.data.required_status_checks).toBeDefined()
  expect(successResult.changedFiles).toEqual([])
})

test('includes authorization header in requests', async (): Promise<void> => {
  const fetchCalls: string[] = []

  const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const authHeader = options?.headers ? (options.headers as Record<string, string>)['Authorization'] : undefined
    fetchCalls.push(authHeader || 'no-auth')

    if (url.includes('/rulesets')) {
      return Response.json([], {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    if (url.includes('/branches/main/protection')) {
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
    throw new Error(`Unexpected URL: ${url}`)
  }

  await getBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: mockFetch as any,
    fs: FsPromises as any,
    githubToken: 'secret-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(fetchCalls.every((call) => call === 'Bearer secret-token')).toBe(true)
  expect(fetchCalls.length).toBeGreaterThan(0)
})
