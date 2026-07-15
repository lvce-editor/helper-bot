import { expect, jest, test } from '@jest/globals'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { planOrgEslintUpdates, planOrgEslintUpdatesMigration } from '../src/parts/PlanOrgEslintUpdates/PlanOrgEslintUpdates.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const getRequestUrl = (input: string | URL | Request): string => {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input.url
}

const createMockOctokitConstructor = (repositories: readonly any[]): any => {
  return class {
    request = async (route: string, options: any): Promise<any> => {
      expect(route).toBe('GET /orgs/{org}/repos')
      expect(options).toMatchObject({ org: 'lvce-editor', type: 'public' })
      return { data: repositories }
    }
  }
}

const createLatestVersionsFetch = (): typeof globalThis.fetch => {
  return jest.fn(async (url: string | URL | Request) => {
    const versions: Record<string, string> = {
      'https://registry.npmjs.org/@lvce-editor/eslint-config/latest': '16.4.0',
      'https://registry.npmjs.org/eslint/latest': '10.7.0',
    }
    const requestUrl = getRequestUrl(url)
    return {
      json: async () => ({ version: versions[requestUrl] }),
      ok: true,
    } as Response
  })
}

test('sequentially plans eslint updates and disposes each cloned repository', async () => {
  const outdatedUri = pathToUri('/tmp/outdated') + '/'
  const currentUri = pathToUri('/tmp/current') + '/'
  const fs = createMockFs({
    files: {
      [resolveUri('package.json', currentUri)]: JSON.stringify({
        devDependencies: {
          '@lvce-editor/eslint-config': '^16.4.0',
          eslint: '^10.7.0',
        },
      }),
      [resolveUri('package.json', outdatedUri)]: JSON.stringify({
        devDependencies: {
          '@lvce-editor/eslint-config': '^16.3.0',
          eslint: '^10.6.0',
        },
      }),
    },
  })
  const events: string[] = []
  const cloneRepository = jest.fn(async (_exec: any, _owner: string, repo: string) => {
    events.push(`clone:${repo}`)
    return {
      async [Symbol.asyncDispose](): Promise<void> {
        events.push(`dispose:${repo}`)
      },
      uri: repo === 'outdated' ? outdatedUri : currentUri,
    }
  })
  const repositories = [{ name: 'outdated' }, { name: 'current' }, { archived: true, name: 'archived' }]
  const plan = await planOrgEslintUpdates({
    cloneRepository: cloneRepository as any,
    exec: jest.fn() as any,
    fetch: createLatestVersionsFetch(),
    fs,
    now: '2026-07-15T00:00:00.000Z',
    OctokitConstructor: createMockOctokitConstructor(repositories),
  })

  expect(events).toEqual(['clone:outdated', 'dispose:outdated', 'clone:current', 'dispose:current'])
  expect(plan).toEqual({
    entries: [
      {
        currentVersions: {
          eslint: '^10.6.0',
          eslintConfig: '^16.3.0',
        },
        repository: 'lvce-editor/outdated',
        upgrade: true,
      },
      {
        currentVersions: {
          eslint: '^10.7.0',
          eslintConfig: '^16.4.0',
        },
        nonUpgradeReason: 'eslint dependencies already up to date',
        repository: 'lvce-editor/current',
        upgrade: false,
      },
      {
        nonUpgradeReason: 'repository archived',
        repository: 'lvce-editor/archived',
        upgrade: false,
      },
    ],
    generatedAt: '2026-07-15T00:00:00.000Z',
    latestVersions: {
      eslintConfigVersion: '16.4.0',
      eslintVersion: '10.7.0',
    },
    owner: 'lvce-editor',
    schemaVersion: 1,
    summary: {
      scanned: 3,
      skipped: 2,
      upgrade: 1,
    },
  })
})

test('returns the eslint update plan as migration artifact data', async () => {
  const result = await planOrgEslintUpdatesMigration({
    cloneRepository: jest.fn() as any,
    exec: jest.fn() as any,
    fetch: createLatestVersionsFetch(),
    fs: createMockFs(),
    now: '2026-07-15T00:00:00.000Z',
    OctokitConstructor: createMockOctokitConstructor([]),
  })

  expect(result).toMatchObject({
    changedFiles: [],
    data: {
      eslintUpdatePlan: {
        entries: [],
        latestVersions: {
          eslintConfigVersion: '16.4.0',
          eslintVersion: '10.7.0',
        },
      },
    },
    status: 'success',
    statusCode: 200,
  })
})
