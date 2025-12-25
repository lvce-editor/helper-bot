import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'
import nock from 'nock'
import { updateBranchProtection } from '../src/parts/UpdateBranchProtection/UpdateBranchProtection.ts'

let consoleErrorSpy: ReturnType<typeof jest.spyOn>

beforeEach(() => {
  nock.disableNetConnect()
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
  consoleErrorSpy.mockRestore()
})

test('returns undefined when no osVersions provided', async (): Promise<void> => {
  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toBeUndefined()
})

test('updates branch rulesets successfully', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [
        {
          bypass_actors: [],
          conditions: {
            ref_name: {
              include: ['~DEFAULT_BRANCH'],
            },
          },
          enforcement: 'active',
          id: 1,
          name: 'Branch Protection',
          rules: [
            {
              parameters: {
                checks: ['ci/test-ubuntu-22.04', 'ci/build-windows-2022'],
              },
              type: 'required_status_checks',
            },
          ],
          target: 'branch',
        },
      ],
    })
    .patch('/repos/test-owner/test-repo/rulesets/1')
    .reply(200, {
      id: 1,
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(404, {
      message: 'Not Found',
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      macos: '15',
      ubuntu: '24.04',
      windows: '2025',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: false,
    updatedRulesets: 1,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('updates classic branch protection when no rulesets', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [],
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(200, {
      data: {
        required_status_checks: {
          contexts: ['ci/test-ubuntu-22.04', 'ci/build-windows-2022'],
          strict: true,
        },
      },
    })
    .patch('/repos/test-owner/test-repo/branches/main/protection/required_status_checks', (body) => {
      expect(Array.isArray(body.contexts)).toBe(true)
      expect(body.contexts).toContain('ci/test-ubuntu-24.04')
      expect(body.contexts).toContain('ci/build-windows-2025')
      expect(body.strict).toBe(true)
      return true
    })
    .reply(200, {
      data: {},
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      ubuntu: '24.04',
      windows: '2025',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: true,
    updatedRulesets: 0,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('skips update when no changes needed', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [
        {
          id: 1,
          name: 'Branch Protection',
          target: 'branch',
          enforcement: 'active',
          conditions: {},
          bypass_actors: [],
          rules: [
            {
              type: 'required_status_checks',
              parameters: {
                checks: ['ci/test-ubuntu-24.04'],
              },
            },
          ],
        },
      ],
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(404, {
      message: 'Not Found',
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      ubuntu: '24.04',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: false,
    updatedRulesets: 0,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('handles 404 when rulesets not available', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(404, {
      message: 'Not Found',
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(200, {
      data: {
        required_status_checks: {
          contexts: ['ci/test-ubuntu-22.04'],
          strict: false,
        },
      },
    })
    .patch('/repos/test-owner/test-repo/branches/main/protection/required_status_checks', (body) => {
      expect(Array.isArray(body.contexts)).toBe(true)
      expect(body.contexts).toContain('ci/test-ubuntu-24.04')
      expect(body.strict).toBe(false)
      return true
    })
    .reply(200, {
      data: {},
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      ubuntu: '24.04',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: true,
    updatedRulesets: 0,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('handles organization rulesets', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [
        {
          id: 2,
          name: 'Org Branch Protection',
          target: 'branch',
          enforcement: 'active',
          conditions: {},
          bypass_actors: [],
          source: {
            type: 'Organization',
          },
          rules: [
            {
              type: 'required_status_checks',
              parameters: {
                checks: ['ci/test-ubuntu-22.04'],
              },
            },
          ],
        },
      ],
    })
    .patch('/orgs/test-owner/rulesets/2')
    .reply(200, {
      id: 2,
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(404, {
      message: 'Not Found',
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      ubuntu: '24.04',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: false,
    updatedRulesets: 1,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('updates required_status_checks.required_checks format', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [
        {
          id: 3,
          name: 'Branch Protection',
          target: 'branch',
          enforcement: 'active',
          conditions: {},
          bypass_actors: [],
          rules: [
            {
              type: 'required_status_checks',
              parameters: {
                required_status_checks: {
                  required_checks: [{ context: 'ci/test-ubuntu-22.04' }, { context: 'ci/build-windows-2022' }],
                },
              },
            },
          ],
        },
      ],
    })
    .patch('/repos/test-owner/test-repo/rulesets/3')
    .reply(200, {
      id: 3,
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(404, {
      message: 'Not Found',
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      ubuntu: '24.04',
      windows: '2025',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: false,
    updatedRulesets: 1,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('handles classic protection 404', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [],
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(404, {
      message: 'Not Found',
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      ubuntu: '24.04',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: false,
    updatedRulesets: 0,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('handles classic protection without required_status_checks', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [],
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(200, {
      data: {
        required_pull_request_reviews: {
          required_approving_review_count: 1,
        },
      },
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      ubuntu: '24.04',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: false,
    updatedRulesets: 0,
  })
  expect(scope.pendingMocks()).toEqual([])
})

test('updates macos versions', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/rulesets')
    .query({ includes_parents: true })
    .reply(200, {
      data: [
        {
          id: 4,
          name: 'Branch Protection',
          target: 'branch',
          enforcement: 'active',
          conditions: {},
          bypass_actors: [],
          rules: [
            {
              type: 'required_status_checks',
              parameters: {
                checks: ['ci/test-macos-14'],
              },
            },
          ],
        },
      ],
    })
    .patch('/repos/test-owner/test-repo/rulesets/4')
    .reply(200, {
      id: 4,
    })
    .get('/repos/test-owner/test-repo/branches/main/protection')
    .reply(404, {
      message: 'Not Found',
    })

  const result = await updateBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    osVersions: {
      macos: '15',
    },
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    updatedClassicProtection: false,
    updatedRulesets: 1,
  })
  expect(scope.pendingMocks()).toEqual([])
})
