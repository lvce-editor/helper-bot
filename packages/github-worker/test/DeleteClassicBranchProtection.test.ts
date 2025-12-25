import { afterEach, beforeEach, expect, test } from '@jest/globals'
import nock from 'nock'
import { deleteClassicBranchProtection } from '../src/parts/DeleteClassicBranchProtection/DeleteClassicBranchProtection.ts'

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})

test('deletes classic branch protection successfully', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .matchHeader('x-github-api-version', '2022-11-28')
    .delete('/repos/test-owner/test-repo/branches/main/protection')
    .reply(204)

  const result = await deleteClassicBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    success: true,
  })
  expect(scope.isDone()).toBe(true)
})

test('returns error when deletion fails with non-204 status', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .matchHeader('x-github-api-version', '2022-11-28')
    .delete('/repos/test-owner/test-repo/branches/main/protection')
    .reply(403, {
      message: 'Forbidden',
    })

  const result = await deleteClassicBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    error: expect.stringContaining('Failed to delete classic branch protection'),
    success: false,
  })
  expect(scope.isDone()).toBe(true)
})

test('returns error when deletion throws exception', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .matchHeader('x-github-api-version', '2022-11-28')
    .delete('/repos/test-owner/test-repo/branches/main/protection')
    .replyWithError('Network error')

  const result = await deleteClassicBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    error: expect.stringContaining('Failed to delete classic branch protection'),
    success: false,
  })
  expect(scope.isDone()).toBe(true)
})

test('handles 404 error', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .matchHeader('x-github-api-version', '2022-11-28')
    .delete('/repos/test-owner/test-repo/branches/main/protection')
    .reply(404, {
      message: 'Not Found',
    })

  const result = await deleteClassicBranchProtection({
    branch: 'main',
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    error: expect.stringContaining('Failed to delete classic branch protection'),
    success: false,
  })
  expect(scope.isDone()).toBe(true)
})

