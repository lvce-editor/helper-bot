import { expect, test } from '@jest/globals'
import { commandMap } from '../src/parts/CommandMap/CommandMap.ts'
import { updateRecent, updateRecentMigration, type UpdateRecentResult } from '../src/parts/UpdateRecent/UpdateRecent.ts'

const createMockOctokitConstructor = (request: (route: string, options: any) => Promise<any>): any => {
  return class {
    request: (route: string, options: any) => Promise<any>

    constructor() {
      this.request = request
    }
  }
}

const createRepo = (name: string, options: Record<string, any> = {}): any => {
  return {
    archived: false,
    default_branch: 'main',
    disabled: false,
    fork: false,
    name,
    ...options,
  }
}

const requestRecentRepo = async (route: string): Promise<any> => {
  if (route === 'GET /orgs/{org}/repos') {
    return {
      data: [createRepo('recent')],
    }
  }
  if (route === 'GET /repos/{owner}/{repo}/commits') {
    return {
      data: [{ sha: 'recent-sha' }],
    }
  }
  throw new Error(`Unexpected route: ${route}`)
}

test('finds repositories with default branch commits in the last 48 hours', async () => {
  const commitRequests: any[] = []
  const request = async (route: string, options: any): Promise<any> => {
    if (route === 'GET /orgs/{org}/repos') {
      return {
        data: [
          createRepo('recent'),
          createRepo('quiet'),
          createRepo('archived', { archived: true }),
          createRepo('disabled', { disabled: true }),
          createRepo('forked', { fork: true }),
        ],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/commits') {
      commitRequests.push(options)
      return {
        data: options.repo === 'recent' ? [{ sha: 'recent-sha' }] : [],
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  }

  const result = await updateRecent({
    now: '2026-07-01T12:00:00.000Z',
    OctokitConstructor: createMockOctokitConstructor(request),
  })

  expect(result).toEqual({
    generatedAt: '2026-07-01T12:00:00.000Z',
    lookbackHours: 48,
    owner: 'lvce-editor',
    repositories: ['lvce-editor/recent'],
    schemaVersion: 1,
    summary: {
      recent: 1,
      scanned: 5,
      skipped: 3,
    },
  } satisfies UpdateRecentResult)
  expect(commitRequests).toEqual([
    {
      owner: 'lvce-editor',
      per_page: 1,
      repo: 'recent',
      sha: 'main',
      since: '2026-06-29T12:00:00.000Z',
    },
    {
      owner: 'lvce-editor',
      per_page: 1,
      repo: 'quiet',
      sha: 'main',
      since: '2026-06-29T12:00:00.000Z',
    },
  ])
})

test('uses the repository default branch when checking for recent commits', async () => {
  let commitRequest: any
  const request = async (route: string, options: any): Promise<any> => {
    if (route === 'GET /orgs/{org}/repos') {
      return {
        data: [createRepo('example', { default_branch: 'develop' })],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/commits') {
      commitRequest = options
      return {
        data: [{ sha: 'recent-sha' }],
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  }

  await updateRecent({
    now: '2026-07-01T12:00:00.000Z',
    OctokitConstructor: createMockOctokitConstructor(request),
  })

  expect(commitRequest).toMatchObject({
    repo: 'example',
    sha: 'develop',
  })
})

test('paginates public organization repositories', async () => {
  const firstPageRepos = Array.from({ length: 100 }, (_, index) => createRepo(`archived-${index}`, { archived: true }))
  const listOptions: any[] = []
  const request = async (route: string, options: any): Promise<any> => {
    if (route === 'GET /orgs/{org}/repos') {
      listOptions.push(options)
      return {
        data: options.page === 1 ? firstPageRepos : [createRepo('recent')],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/commits') {
      return {
        data: [{ sha: 'recent-sha' }],
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  }

  const result = await updateRecent({
    now: '2026-07-01T12:00:00.000Z',
    OctokitConstructor: createMockOctokitConstructor(request),
  })

  expect(listOptions).toEqual([
    {
      org: 'lvce-editor',
      page: 1,
      per_page: 100,
      type: 'public',
    },
    {
      org: 'lvce-editor',
      page: 2,
      per_page: 100,
      type: 'public',
    },
  ])
  expect(result.repositories).toEqual(['lvce-editor/recent'])
  expect(result.summary).toEqual({
    recent: 1,
    scanned: 101,
    skipped: 100,
  })
})

test('returns update-recent artifact data from the migration command', async () => {
  const result = await updateRecentMigration({
    now: '2026-07-01T12:00:00.000Z',
    OctokitConstructor: createMockOctokitConstructor(requestRecentRepo),
  })

  expect(result).toMatchObject({
    changedFiles: [],
    data: {
      updateRecent: {
        repositories: ['lvce-editor/recent'],
      },
    },
    pullRequestTitle: 'update-recent',
    status: 'success',
    statusCode: 200,
  })
})

test('registers update-recent as a migrations2 command', () => {
  expect(commandMap).toHaveProperty('/migrations2/update-recent')
})
