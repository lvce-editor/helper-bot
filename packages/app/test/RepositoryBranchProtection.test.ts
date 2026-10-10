import { expect, jest, test } from '@jest/globals'
import { assertBranchOwnership, planBranches, validateBranches } from '../src/parts/RepositoryConfig/RepositoryBranchProtection.ts'

const base = [{ name: 'main', protection: { enforce_admins: false, required_pull_request_reviews: { required_approving_review_count: 1 } } }]
const desired = [{ name: 'main', protection: { enforce_admins: true, required_pull_request_reviews: { required_approving_review_count: 2 } } }]

test.each([
  [{ name: 'main', protection: null }],
  [{ name: 'main', protection: { required_status_checks: null } }],
  [{ name: 'main', protection: { required_pull_request_reviews: { required_approving_review_count: 7 } } }],
  [{ name: '../main', protection: { enforce_admins: true } }],
])('rejects unsupported or malformed branch protection %j', (value) => expect(() => validateBranches(value)).toThrow())

test('branch fields require immutable bootstrapped ownership', () => {
  validateBranches(desired)
  assertBranchOwnership(base, desired)
  expect(() => assertBranchOwnership(base, [])).toThrow('Bootstrap')
  expect(() => assertBranchOwnership(base, [{ name: 'main', protection: { required_signatures: true } }])).toThrow('Bootstrap')
})

test('uses partial endpoints to retain required checks, restrictions and other review settings', async () => {
  const live = {
    enforce_admins: { enabled: false },
    required_pull_request_reviews: { required_approving_review_count: 1, require_code_owner_reviews: true },
    required_status_checks: { contexts: ['matrix'] },
    restrictions: { users: ['owner'] },
  }
  const setAdminBranchProtection = jest.fn<() => Promise<any>>().mockImplementation(async () => {
    live.enforce_admins.enabled = true
  })
  const updatePullRequestReviewProtection = jest.fn<(options: any) => Promise<any>>().mockImplementation(async (options) => {
    live.required_pull_request_reviews.required_approving_review_count = options.required_approving_review_count
  })
  const getBranchProtection = jest.fn<() => Promise<any>>().mockResolvedValue({ data: live })
  const octokit: any = { rest: { repos: { setAdminBranchProtection, updatePullRequestReviewProtection, getBranchProtection } } }
  for (const write of await planBranches(octokit, 'lvce-editor', 'about-view', base, desired)) await write()
  expect(updatePullRequestReviewProtection).toHaveBeenCalledWith({
    owner: 'lvce-editor',
    repo: 'about-view',
    branch: 'main',
    required_approving_review_count: 2,
  })
  expect(live.required_status_checks.contexts).toEqual(['matrix'])
  expect(live.required_pull_request_reviews.require_code_owner_reviews).toBe(true)
  expect(live.restrictions).toEqual({ users: ['owner'] })
  expect(await planBranches(octokit, 'lvce-editor', 'about-view', base, desired)).toHaveLength(0)
})

test('preflights review conflicts without writing admin enforcement', async () => {
  const setAdminBranchProtection = jest.fn()
  const octokit: any = {
    rest: {
      repos: {
        setAdminBranchProtection,
        getBranchProtection: jest
          .fn<() => Promise<any>>()
          .mockResolvedValue({ data: { enforce_admins: { enabled: false }, required_pull_request_reviews: { required_approving_review_count: 3 } } }),
      },
    },
  }
  await expect(planBranches(octokit, 'lvce-editor', 'about-view', base, desired)).rejects.toThrow('conflicts')
  expect(setAdminBranchProtection).not.toHaveBeenCalled()
})

test('signature protection uses dedicated API endpoints and verifies effective state', async () => {
  const live = { required_signatures: { enabled: false } }
  const createCommitSignatureProtection = jest.fn<() => Promise<any>>().mockImplementation(async () => {
    live.required_signatures.enabled = true
  })
  const deleteCommitSignatureProtection = jest.fn<() => Promise<any>>().mockImplementation(async () => {
    live.required_signatures.enabled = false
  })
  const octokit: any = {
    rest: {
      repos: {
        createCommitSignatureProtection,
        deleteCommitSignatureProtection,
        getBranchProtection: jest.fn<() => Promise<any>>().mockResolvedValue({ data: live }),
      },
    },
  }
  const before = [{ name: 'main', protection: { required_signatures: false } }]
  const after = [{ name: 'main', protection: { required_signatures: true } }]
  for (const write of await planBranches(octokit, 'lvce-editor', 'about-view', before, after)) await write()
  expect(createCommitSignatureProtection).toHaveBeenCalledTimes(1)
  for (const write of await planBranches(octokit, 'lvce-editor', 'about-view', after, before)) await write()
  expect(deleteCommitSignatureProtection).toHaveBeenCalledTimes(1)
})
