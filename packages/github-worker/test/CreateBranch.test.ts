import { afterEach, beforeEach, expect, test } from '@jest/globals'
import nock from 'nock'
import { createBranch } from '../src/parts/CreateBranch/CreateBranch.ts'

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})

test('creates branch successfully', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
    .reply(200, {
      object: {
        sha: 'base-sha',
      },
    })
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/heads/new-branch',
      sha: 'base-sha',
    })
    .reply(201, {
      ref: 'refs/heads/new-branch',
    })

  await createBranch({
    baseBranch: 'main',
    branchName: 'new-branch',
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(scope.isDone()).toBe(true)
})

test('uses default base branch when not provided', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
    .reply(200, {
      object: {
        sha: 'base-sha',
      },
    })
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/heads/new-branch',
      sha: 'base-sha',
    })
    .reply(201, {
      ref: 'refs/heads/new-branch',
    })

  await createBranch({
    branchName: 'new-branch',
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(scope.isDone()).toBe(true)
})

test('throws error when base branch not found', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fnonexistent')
    .reply(404, {
      message: 'Not Found',
    })

  await expect(
    createBranch({
      baseBranch: 'nonexistent',
      branchName: 'new-branch',
      githubToken: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    }),
  ).rejects.toThrow()

  expect(scope.isDone()).toBe(true)
})

test('throws error when branch creation fails', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
    .reply(200, {
      object: {
        sha: 'base-sha',
      },
    })
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/heads/new-branch',
      sha: 'base-sha',
    })
    .reply(422, {
      message: 'Reference already exists',
    })

  await expect(
    createBranch({
      baseBranch: 'main',
      branchName: 'new-branch',
      githubToken: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    }),
  ).rejects.toThrow()

  expect(scope.isDone()).toBe(true)
})

