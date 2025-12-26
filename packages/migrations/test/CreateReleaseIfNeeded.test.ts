import type { Octokit } from '@octokit/rest'
import { expect, test } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { createReleaseIfNeeded } from '../src/parts/CreateReleaseIfNeeded/CreateReleaseIfNeeded.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()
const clonedRepoUri = pathToUri('/test/repo')
const mockFs = createMockFs()

const createMockOctokit = (
  requestHandler: (route: string, options: any) => Promise<any>,
  createRefHandler?: (ref: string, sha: string) => Promise<any>,
): Octokit => {
  return {
    git: {
      createRef: async (params: any) => {
        if (createRefHandler) {
          return await createRefHandler(params.ref, params.sha)
        }
        return {
          data: {
            ref: params.ref,
            sha: params.sha,
          },
        }
      },
    },
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

test('returns success when no releases or tags found', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      const error: any = new Error('Not Found')
      error.status = 404
      throw error
    }
    if (route === 'GET /repos/{owner}/{repo}/tags') {
      return {
        data: [],
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
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
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: 'v1.2.3',
          target_commitish: 'tag-sha-123',
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
      return {
        data: {
          object: {
            sha: 'tag-sha-123',
          },
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
      return {
        data: {
          ahead_by: 0,
          status: 'identical',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
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
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v1.2.3',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 5,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/v1.3.0' && sha === 'main-sha-456') {
        return {
          data: {
            ref: 'refs/tags/v1.3.0',
            sha: 'main-sha-456',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result).toEqual({
    branchName: undefined,
    changedFiles: [],
    commitMessage: undefined,
    data: {
      message: 'Created new tag v1.3.0 with 5 new commits since v1.2.3. GitHub Actions CI will create the release.',
      releaseTag: 'v1.3.0',
    },
    pullRequestTitle: 'create-release-if-needed',
    status: 'success',
    statusCode: 201,
  })
})

test('creates new release with single commit', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v2.5.10',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 1,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/v2.6.0' && sha === 'main-sha-456') {
        return {
          data: {
            ref: 'refs/tags/v2.6.0',
            sha: 'main-sha-456',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result).toEqual({
    branchName: undefined,
    changedFiles: [],
    commitMessage: undefined,
    data: {
      message: 'Created new tag v2.6.0 with 1 new commit since v2.5.10. GitHub Actions CI will create the release.',
      releaseTag: 'v2.6.0',
    },
    pullRequestTitle: 'create-release-if-needed',
    status: 'success',
    statusCode: 201,
  })
})

test('handles version without v prefix', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: '1.2.3',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 3,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/1.3.0' && sha === 'main-sha-456') {
        return {
          data: {
            ref: 'refs/tags/1.3.0',
            sha: 'main-sha-456',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { releaseTag: string } }
  expect(successResult.data?.releaseTag).toBe('1.3.0')
})

test('falls back to tags when no releases exist', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        const error: any = new Error('Not Found')
        error.status = 404
        throw error
      }
      if (route === 'GET /repos/{owner}/{repo}/tags') {
        return {
          data: [
            {
              name: 'v3.1.5',
            },
          ],
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/tags/{ref}') {
        return {
          data: {
            object: {
              sha: 'tag-sha-789',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-999',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 2,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/v3.2.0' && sha === 'main-sha-999') {
        return {
          data: {
            ref: 'refs/tags/v3.2.0',
            sha: 'main-sha-999',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { releaseTag: string }; statusCode: number }
  expect(successResult.data?.releaseTag).toBe('v3.2.0')
  expect(successResult.statusCode).toBe(201)
})

test('handles custom base branch', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v1.0.0',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'master-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 1,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/v1.1.0' && sha === 'master-sha-456') {
        return {
          data: {
            ref: 'refs/tags/v1.1.0',
            sha: 'master-sha-456',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    baseBranch: 'master',
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { releaseTag: string } }
  expect(successResult.data?.releaseTag).toBe('v1.1.0')
})

test('handles error when getting branch ref fails', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: 'v1.2.3',
          target_commitish: 'tag-sha-123',
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
      throw new Error('Failed to get branch ref')
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  const errorResult = result as { status: 'error'; errorCode: string; errorMessage: string }
  expect(errorResult.errorCode).toBe('CREATE_RELEASE_IF_NEEDED_FAILED')
  expect(errorResult.errorMessage).toContain('Failed to get branch ref')
})

test('handles error when creating tag fails', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v1.2.3',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 1,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (_ref: string, _sha: string) => {
      throw new Error('Reference already exists')
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  const errorResult = result as { status: 'error'; errorCode: string; errorMessage: string }
  expect(errorResult.errorCode).toBe('CREATE_RELEASE_IF_NEEDED_FAILED')
  expect(errorResult.errorMessage).toContain('Reference already exists')
})

test('handles error when creating tag via API fails', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v1.2.3',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 1,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (_ref: string, _sha: string) => {
      throw new Error('Permission denied')
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  const errorResult = result as { status: 'error'; errorCode: string; errorMessage: string }
  expect(errorResult.errorCode).toBe('CREATE_RELEASE_IF_NEEDED_FAILED')
  expect(errorResult.errorMessage).toContain('Permission denied')
})

test('handles invalid version format', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: 'invalid-version',
          target_commitish: 'tag-sha-123',
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
      return {
        data: {
          object: {
            sha: 'main-sha-456',
          },
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
      return {
        data: {
          ahead_by: 1,
          status: 'ahead',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  const errorResult = result as { status: 'error'; errorCode: string; errorMessage: string }
  expect(errorResult.errorCode).toBe('CREATE_RELEASE_IF_NEEDED_FAILED')
  expect(errorResult.errorMessage).toContain('Invalid version format')
})

test('handles version with only two parts', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: '1.2',
          target_commitish: 'tag-sha-123',
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
      return {
        data: {
          object: {
            sha: 'main-sha-456',
          },
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
      return {
        data: {
          ahead_by: 1,
          status: 'ahead',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  const errorResult = result as { status: 'error'; errorMessage: string }
  expect(errorResult.errorMessage).toContain('Expected format: major.minor.patch')
})

test('handles version with non-numeric parts', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: 'v1.2.x',
          target_commitish: 'tag-sha-123',
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
      return {
        data: {
          object: {
            sha: 'main-sha-456',
          },
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
      return {
        data: {
          ahead_by: 1,
          status: 'ahead',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('error')
  const errorResult = result as { status: 'error'; errorMessage: string }
  expect(errorResult.errorMessage).toContain('All parts must be numbers')
})

test('handles compare commits returning non-200 status', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v1.2.3',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        throw new Error('Internal Server Error')
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/v1.3.0' && sha === 'main-sha-456') {
        return {
          data: {
            ref: 'refs/tags/v1.3.0',
            sha: 'main-sha-456',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  // Should assume there are commits when comparison fails
  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { releaseTag: string } }
  expect(successResult.data?.releaseTag).toBe('v1.3.0')
})

test('handles compare commits with diverged status', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v1.2.3',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 3,
            status: 'diverged',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/v1.3.0' && sha === 'main-sha-456') {
        return {
          data: {
            ref: 'refs/tags/v1.3.0',
            sha: 'main-sha-456',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { releaseTag: string; message: string } }
  expect(successResult.data?.releaseTag).toBe('v1.3.0')
  expect(successResult.data?.message).toContain('3 new commits')
})

test('handles compare commits with ahead_by 0', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: 'v1.2.3',
          target_commitish: 'tag-sha-123',
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
      return {
        data: {
          object: {
            sha: 'main-sha-456',
          },
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
      return {
        data: {
          ahead_by: 0,
          status: 'behind',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { message: string } }
  expect(successResult.data?.message).toContain('No new commits')
})

test('handles tags endpoint returning empty array', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      const error: any = new Error('Not Found')
      error.status = 404
      throw error
    }
    if (route === 'GET /repos/{owner}/{repo}/tags') {
      return {
        data: [],
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { message: string } }
  expect(successResult.data?.message).toContain('No releases or tags found')
})

test('handles tag ref fetch failure', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      const error: any = new Error('Not Found')
      error.status = 404
      throw error
    }
    if (route === 'GET /repos/{owner}/{repo}/tags') {
      return {
        data: [
          {
            name: 'v1.0.0',
          },
        ],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/tags/{ref}') {
      const error: any = new Error('Not Found')
      error.status = 404
      throw error
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { message: string } }
  expect(successResult.data?.message).toContain('No releases or tags found')
})

test('handles large version numbers', async (): Promise<void> => {
  const mockOctokit = createMockOctokit(
    async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
        return {
          data: {
            tag_name: 'v99.88.77',
            target_commitish: 'tag-sha-123',
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/git/refs/heads/{ref}') {
        return {
          data: {
            object: {
              sha: 'main-sha-456',
            },
          },
        }
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
        return {
          data: {
            ahead_by: 1,
            status: 'ahead',
          },
        }
      }
      throw new Error(`Unexpected route: ${route}`)
    },
    async (ref: string, sha: string) => {
      if (ref === 'refs/tags/v99.89.0' && sha === 'main-sha-456') {
        return {
          data: {
            ref: 'refs/tags/v99.89.0',
            sha: 'main-sha-456',
          },
        }
      }
      throw new Error(`Unexpected createRef call: ref=${ref}, sha=${sha}`)
    },
  )

  const result = await createReleaseIfNeeded({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'repo',
    repositoryOwner: 'owner',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; data?: { releaseTag: string } }
  expect(successResult.data?.releaseTag).toBe('v99.89.0')
})
