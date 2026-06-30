import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'
import nock from 'nock'
import { createTagRef } from '../src/parts/CreateTagRef/CreateTagRef.ts'

beforeEach(() => {
  nock.disableNetConnect()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
  jest.restoreAllMocks()
})

test('creates tag ref successfully', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/tags/v1.3.0',
      sha: 'main-sha',
    })
    .reply(201, {
      ref: 'refs/tags/v1.3.0',
    })

  const result = await createTagRef({
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    sha: 'main-sha',
    tag: 'v1.3.0',
  })

  expect(result).toEqual({
    message: 'Created tag v1.3.0',
    status: 'created',
  })
  expect(scope.isDone()).toBe(true)
})

test('skips when tag ref already exists', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/tags/v1.3.0',
      sha: 'main-sha',
    })
    .reply(422, {
      message: 'Reference already exists',
    })

  const result = await createTagRef({
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    sha: 'main-sha',
    tag: 'v1.3.0',
  })

  expect(result).toEqual({
    message: 'Tag v1.3.0 already exists',
    status: 'skipped',
  })
  expect(scope.isDone()).toBe(true)
})
