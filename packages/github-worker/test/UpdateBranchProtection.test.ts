import { afterEach, beforeEach, expect, test } from '@jest/globals'
import nock from 'nock'
import { updateBranchProtection } from '../src/parts/UpdateBranchProtection/UpdateBranchProtection.ts'

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
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
          id: 1,
          name: 'Branch Protection',
          target: 'branch',
          enforcement: 'active',
          conditions: {
            ref_name: {
              include: ['~DEFAULT_BRANCH'],
            },
          },
          bypass_actors: [],
          rules: [
            {
              type: 'required_status_checks',
              parameters: {
                checks: ['ci/test-ubuntu-22.04', 'ci/build-windows-2022'],
              },
            },
          ],
        },
      ],
    })
    .patch('/repos/test-owner/test-repo/rulesets/1', (body: any) => {
      return (
        body.rules[0].parameters.checks.includes('ci/test-ubuntu-24.04') &&
        body.rules[0].parameters.checks.includes('ci/build-windows-2025')
      )
    })
    .reply(200, {
      id: 1,
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
  expect(scope.isDone()).toBe(true)
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
    .patch('/repos/test-owner/test-repo/branches/main/protection/required_status_checks', (body: any) => {
      return (
        body.contexts.includes('ci/test-ubuntu-24.04') &&
        body.contexts.includes('ci/build-windows-2025') &&
        body.strict === true
      )
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
  expect(scope.isDone()).toBe(true)
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
  expect(scope.isDone()).toBe(true)
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
    .patch('/repos/test-owner/test-repo/branches/main/protection/required_status_checks', {
      contexts: ['ci/test-ubuntu-24.04'],
      strict: false,
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
  expect(scope.isDone()).toBe(true)
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
    .patch('/orgs/test-owner/rulesets/2', (body: any) => {
      return body.rules[0].parameters.checks.includes('ci/test-ubuntu-24.04')
    })
    .reply(200, {
      id: 2,
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
  expect(scope.isDone()).toBe(true)
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
                  required_checks: [
                    { context: 'ci/test-ubuntu-22.04' },
                    { context: 'ci/build-windows-2022' },
                  ],
                },
              },
            },
          ],
        },
      ],
    })
    .patch('/repos/test-owner/test-repo/rulesets/3', (body: any) => {
      const checks = body.rules[0].parameters.required_status_checks.required_checks
      return (
        checks.some((c: any) => c.context === 'ci/test-ubuntu-24.04') &&
        checks.some((c: any) => c.context === 'ci/build-windows-2025')
      )
    })
    .reply(200, {
      id: 3,
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
  expect(scope.isDone()).toBe(true)
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
  expect(scope.isDone()).toBe(true)
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
  expect(scope.isDone()).toBe(true)
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
    .patch('/repos/test-owner/test-repo/rulesets/4', (body: any) => {
      return body.rules[0].parameters.checks.includes('ci/test-macos-15')
    })
    .reply(200, {
      id: 4,
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
  expect(scope.isDone()).toBe(true)
})

