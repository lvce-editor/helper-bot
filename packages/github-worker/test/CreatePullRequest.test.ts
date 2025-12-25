import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'
import nock from 'nock'
import { createPullRequest } from '../src/parts/CreatePullRequest/CreatePullRequest.ts'

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

test('creates pull request successfully', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .post('/repos/test-owner/test-repo/pulls', {
      base: 'main',
      head: 'feature-branch',
      title: 'Test PR',
    })
    .reply(201, {
      number: 123,
      node_id: 'PR_node_id_123',
    })
    .post('/graphql', (body: any) => {
      return typeof body.query === 'string' && body.query.includes('enablePullRequestAutoMerge')
    })
    .reply(200, {
      data: {
        enablePullRequestAutoMerge: {
          clientMutationId: null,
        },
      },
    })

  const result = await createPullRequest({
    baseBranch: 'main',
    githubToken: 'test-token',
    headBranch: 'feature-branch',
    owner: 'test-owner',
    repo: 'test-repo',
    title: 'Test PR',
  })

  expect(result).toEqual({
    pullRequestNumber: 123,
  })
  expect(scope.isDone()).toBe(true)
})

test('throws error when PR creation fails', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .post('/repos/test-owner/test-repo/pulls', {
      base: 'main',
      head: 'feature-branch',
      title: 'Test PR',
    })
    .reply(422, {
      message: 'Validation Failed',
      errors: [
        {
          message: 'No commits between main and feature-branch',
        },
      ],
    })

  await expect(
    createPullRequest({
      baseBranch: 'main',
      githubToken: 'test-token',
      headBranch: 'feature-branch',
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test PR',
    }),
  ).rejects.toThrow()

  expect(scope.isDone()).toBe(true)
})

test('throws error when graphql fails', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .post('/repos/test-owner/test-repo/pulls', {
      base: 'main',
      head: 'feature-branch',
      title: 'Test PR',
    })
    .reply(201, {
      number: 456,
      node_id: 'PR_node_id_456',
    })
    .post('/graphql', (body: any) => {
      return typeof body.query === 'string' && body.query.includes('enablePullRequestAutoMerge')
    })
    .reply(200, {
      errors: [
        {
          message: 'Pull request is not mergeable',
        },
      ],
    })

  await expect(
    createPullRequest({
      baseBranch: 'main',
      githubToken: 'test-token',
      headBranch: 'feature-branch',
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test PR',
    }),
  ).rejects.toThrow()

  expect(scope.isDone()).toBe(true)
})
