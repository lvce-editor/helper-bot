import { expect, test } from '@jest/globals'
import { planOrgReleaseTags, type ReleasePlan } from '../src/parts/PlanOrgReleaseTags/PlanOrgReleaseTags.ts'

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

const createPlannerRequest = (repo: any, options: Record<string, any> = {}) => {
  return async (route: string): Promise<any> => {
    if (route === 'GET /orgs/{org}/repos') {
      return {
        data: [repo],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}') {
      return {
        data: {
          commit: {
            sha: options.defaultBranchSha || 'main-sha',
          },
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/tags') {
      return {
        data: options.tags || [
          {
            commit: {
              sha: 'tag-sha',
            },
            name: 'v1.2.3',
          },
        ],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/commits') {
      return {
        data: Array.from({ length: options.recentCommitCount ?? 1 }, (_, index) => ({
          sha: `recent-${index}`,
        })),
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/compare/{base}...{head}') {
      return {
        data: {
          ahead_by: options.commitCountSinceLatestTag ?? 2,
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/actions/workflows') {
      return {
        data: {
          workflows: options.workflows ?? [
            {
              id: 7,
              path: '.github/workflows/release.yml',
            },
          ],
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs') {
      return {
        data: {
          workflow_runs: options.workflowRuns ?? [
            {
              conclusion: 'success',
              head_branch: 'v1.2.3',
              head_sha: 'tag-sha',
              status: 'completed',
            },
          ],
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  }
}

const planExampleRepo = async (options: Record<string, any> = {}): Promise<ReleasePlan> => {
  const repo = createRepo('example')
  const request = createPlannerRequest(repo, options)
  const OctokitConstructor = createMockOctokitConstructor(request)
  return planOrgReleaseTags({
    now: '2026-06-30T01:00:00.000Z',
    OctokitConstructor,
  })
}

const requestArchivedDisabledAndForkRepos = async (route: string): Promise<any> => {
  if (route === 'GET /orgs/{org}/repos') {
    return {
      data: [createRepo('archived', { archived: true }), createRepo('disabled', { disabled: true }), createRepo('forked', { fork: true })],
    }
  }
  throw new Error(`Unexpected route: ${route}`)
}

test('plans a minor tag upgrade for a repo with recent commits since latest semver tag', async () => {
  const plan = await planExampleRepo()

  expect(plan).toEqual({
    entries: [
      {
        commitCountSinceLatestTag: 2,
        defaultBranch: 'main',
        defaultBranchSha: 'main-sha',
        latestTag: 'v1.2.3',
        latestTagSha: 'tag-sha',
        newTag: 'v1.3.0',
        recentCommitCount: 1,
        repository: 'lvce-editor/example',
        targetSha: 'main-sha',
        upgrade: true,
      },
    ],
    generatedAt: '2026-06-30T01:00:00.000Z',
    lookbackHours: 24,
    owner: 'lvce-editor',
    schemaVersion: 1,
    summary: {
      scanned: 1,
      skipped: 0,
      upgrade: 1,
    },
  })
})

test('increments non-v semver tags without adding a v prefix', async () => {
  const plan = await planExampleRepo({
    tags: [
      {
        commit: {
          sha: 'tag-sha',
        },
        name: '1.2.0',
      },
    ],
    workflowRuns: [
      {
        conclusion: 'success',
        head_branch: '1.2.0',
        head_sha: 'tag-sha',
        status: 'completed',
      },
    ],
  })

  expect(plan.entries[0]).toMatchObject({
    latestTag: '1.2.0',
    newTag: '1.3.0',
    upgrade: true,
  })
})

test('skips when there are no recent commits', async () => {
  const plan = await planExampleRepo({
    recentCommitCount: 0,
  })

  expect(plan.entries[0]).toMatchObject({
    nonUpgradeReason: 'no recent commits',
    upgrade: false,
  })
})

test('skips when default branch has no commits since the latest tag', async () => {
  const plan = await planExampleRepo({
    commitCountSinceLatestTag: 0,
  })

  expect(plan.entries[0]).toMatchObject({
    nonUpgradeReason: 'no commits since latest tag',
    upgrade: false,
  })
})

test('skips when there are no semver tags', async () => {
  const plan = await planExampleRepo({
    tags: [
      {
        commit: {
          sha: 'tag-sha',
        },
        name: 'latest',
      },
    ],
  })

  expect(plan.entries[0]).toMatchObject({
    nonUpgradeReason: 'no semver tags',
    upgrade: false,
  })
})

test('skips when the latest tag release workflow failed', async () => {
  const plan = await planExampleRepo({
    workflowRuns: [
      {
        conclusion: 'failure',
        head_branch: 'v1.2.3',
        head_sha: 'tag-sha',
        status: 'completed',
      },
    ],
  })

  expect(plan.entries[0]).toMatchObject({
    nonUpgradeReason: 'release failed',
    upgrade: false,
  })
})

test('skips when the latest tag release workflow is pending', async () => {
  const plan = await planExampleRepo({
    workflowRuns: [
      {
        conclusion: null,
        head_branch: 'v1.2.3',
        head_sha: 'tag-sha',
        status: 'in_progress',
      },
    ],
  })

  expect(plan.entries[0]).toMatchObject({
    nonUpgradeReason: 'release pending',
    upgrade: false,
  })
})

test('skips archived, disabled, and fork repositories', async () => {
  const OctokitConstructor = createMockOctokitConstructor(requestArchivedDisabledAndForkRepos)
  const plan = await planOrgReleaseTags({
    now: '2026-06-30T01:00:00.000Z',
    OctokitConstructor,
  })

  expect(plan.entries).toEqual([
    {
      defaultBranch: 'main',
      nonUpgradeReason: 'repository archived',
      repository: 'lvce-editor/archived',
      upgrade: false,
    },
    {
      defaultBranch: 'main',
      nonUpgradeReason: 'repository disabled',
      repository: 'lvce-editor/disabled',
      upgrade: false,
    },
    {
      defaultBranch: 'main',
      nonUpgradeReason: 'fork repository',
      repository: 'lvce-editor/forked',
      upgrade: false,
    },
  ])
})
