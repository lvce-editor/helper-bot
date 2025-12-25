import { expect, test } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { createReleaseIfNeeded } from '../src/parts/CreateReleaseIfNeeded/CreateReleaseIfNeeded.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()
const clonedRepoUri = pathToUri('/test/repo')
const mockFs = createMockFs()

const createMockFetch = (responses: Array<{ urlPattern: string; status: number; data: any }>) => {
  let callIndex = 0
  return async (url: string, options?: RequestInit): Promise<Response> => {
    if (callIndex >= responses.length) {
      throw new Error(`Unexpected call ${callIndex + 1}: ${url}`)
    }
    const response = responses[callIndex]
    callIndex++

    // Verify URL matches pattern
    if (!url.includes(response.urlPattern)) {
      throw new Error(`URL mismatch at call ${callIndex}: expected pattern "${response.urlPattern}" but got "${url}"`)
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.status >= 200 && response.status < 300 ? 'OK' : 'Not Found',
      json: async () => response.data,
      text: async () => JSON.stringify(response.data),
      headers: new Headers(),
    } as Response
  }
}

test('returns success when no releases or tags found', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 404,
      data: { message: 'Not Found' },
    },
    {
      urlPattern: 'tags',
      status: 200,
      data: [],
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result).toEqual({
    branchName: undefined,
    changedFiles: [],
    commitMessage: undefined,
    data: {
      message: 'No releases or tags found. Skipping release creation.',
    },
    pullRequestTitle: 'create-release-if-needed',
    status: 'success',
    statusCode: 200,
  })
})

test('returns success when no new commits since last release', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'tag-sha-123',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'identical',
        ahead_by: 0,
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result).toEqual({
    branchName: undefined,
    changedFiles: [],
    commitMessage: undefined,
    data: {
      message: 'No new commits since v1.2.3. No release needed.',
    },
    pullRequestTitle: 'create-release-if-needed',
    status: 'success',
    statusCode: 200,
  })
})

test('creates new release when there are new commits', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 5,
      },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: 'v1.3.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result).toEqual({
    branchName: undefined,
    changedFiles: [],
    commitMessage: undefined,
    data: {
      message: 'Created new release v1.3.0 with 5 new commits since v1.2.3',
      releaseTag: 'v1.3.0',
    },
    pullRequestTitle: 'create-release-if-needed',
    status: 'success',
    statusCode: 201,
  })
})

test('creates new release with single commit', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v2.5.10',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 1,
      },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: 'v2.6.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result).toEqual({
    branchName: undefined,
    changedFiles: [],
    commitMessage: undefined,
    data: {
      message: 'Created new release v2.6.0 with 1 new commit since v2.5.10',
      releaseTag: 'v2.6.0',
    },
    pullRequestTitle: 'create-release-if-needed',
    status: 'success',
    statusCode: 201,
  })
})

test('handles version without v prefix', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: '1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 3,
      },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: '1.3.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.releaseTag).toBe('1.3.0')
  }
})

test('falls back to tags when no releases exist', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 404,
      data: { message: 'Not Found' },
    },
    {
      urlPattern: 'tags',
      status: 200,
      data: [
        {
          name: 'v3.1.5',
        },
      ],
    },
    {
      urlPattern: 'refs/tags/v3.1.5',
      status: 200,
      data: {
        object: {
          sha: 'tag-sha-789',
        },
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-999',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 2,
      },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: 'v3.2.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.releaseTag).toBe('v3.2.0')
    expect(result.statusCode).toBe(201)
  }
})

test('handles custom base branch', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.0.0',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/master',
      status: 200,
      data: {
        object: {
          sha: 'master-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 1,
      },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: 'v1.1.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
    baseBranch: 'master',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.releaseTag).toBe('v1.1.0')
  }
})

test('handles error when getting branch ref fails', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 500,
      data: { message: 'Internal Server Error' },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  if (result.status === 'error') {
    expect(result.errorCode).toBe('CREATE_RELEASE_IF_NEEDED_FAILED')
    expect(result.errorMessage).toContain('Failed to get branch ref')
  }
})

test('handles error when creating release fails', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 1,
      },
    },
    {
      urlPattern: 'releases',
      status: 403,
      data: { message: 'Forbidden' },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  if (result.status === 'error') {
    expect(result.errorCode).toBe('CREATE_RELEASE_IF_NEEDED_FAILED')
    expect(result.errorMessage).toContain('Failed to create release')
  }
})

test('handles invalid version format', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'invalid-version',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 1,
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  if (result.status === 'error') {
    expect(result.errorCode).toBe('CREATE_RELEASE_IF_NEEDED_FAILED')
    expect(result.errorMessage).toContain('Invalid version format')
  }
})

test('handles version with only two parts', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: '1.2',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 1,
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  if (result.status === 'error') {
    expect(result.errorMessage).toContain('Expected format: major.minor.patch')
  }
})

test('handles version with non-numeric parts', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.x',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 1,
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  if (result.status === 'error') {
    expect(result.errorMessage).toContain('All parts must be numbers')
  }
})

test('handles compare commits returning non-200 status', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 500,
      data: { message: 'Internal Server Error' },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: 'v1.3.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  // Should assume there are commits when comparison fails
  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.releaseTag).toBe('v1.3.0')
  }
})

test('handles compare commits with diverged status', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'diverged',
        ahead_by: 3,
      },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: 'v1.3.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.releaseTag).toBe('v1.3.0')
    expect(result.data?.message).toContain('3 new commits')
  }
})

test('handles compare commits with ahead_by 0', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v1.2.3',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'behind',
        ahead_by: 0,
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.message).toContain('No new commits')
  }
})

test('handles tags endpoint returning empty array', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 404,
      data: { message: 'Not Found' },
    },
    {
      urlPattern: 'tags',
      status: 200,
      data: [],
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.message).toContain('No releases or tags found')
  }
})

test('handles tag ref fetch failure', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 404,
      data: { message: 'Not Found' },
    },
    {
      urlPattern: 'tags',
      status: 200,
      data: [
        {
          name: 'v1.0.0',
        },
      ],
    },
    {
      urlPattern: 'refs/tags/v1.0.0',
      status: 404,
      data: { message: 'Not Found' },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.message).toContain('No releases or tags found')
  }
})

test('handles large version numbers', async (): Promise<void> => {
  const mockFetch = createMockFetch([
    {
      urlPattern: 'releases/latest',
      status: 200,
      data: {
        tag_name: 'v99.88.77',
        target_commitish: 'tag-sha-123',
      },
    },
    {
      urlPattern: 'refs/heads/main',
      status: 200,
      data: {
        object: {
          sha: 'main-sha-456',
        },
      },
    },
    {
      urlPattern: 'compare',
      status: 200,
      data: {
        status: 'ahead',
        ahead_by: 1,
      },
    },
    {
      urlPattern: 'releases',
      status: 201,
      data: {
        id: 123,
        tag_name: 'v99.89.0',
      },
    },
  ])

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
    fs: mockFs,
    githubToken: 'test-token',
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  if (result.status === 'success') {
    expect(result.data?.releaseTag).toBe('v99.89.0')
  }
})
