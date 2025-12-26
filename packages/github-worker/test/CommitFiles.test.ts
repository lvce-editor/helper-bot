import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'
import nock from 'nock'
import { commitFiles } from '../src/parts/CommitFiles/CommitFiles.ts'

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

test('commits files successfully', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Ftest-branch')
    .reply(200, {
      object: {
        sha: 'base-sha',
      },
    })
    .get('/repos/test-owner/test-repo/git/commits/base-sha')
    .reply(200, {
      sha: 'base-sha',
      tree: {
        sha: 'base-tree-sha',
      },
    })
    .post('/repos/test-owner/test-repo/git/trees', (body: any) => {
      return body.base_tree === 'base-tree-sha' && body.tree.length === 2 && body.tree[0].path === 'file1.txt' && body.tree[1].path === 'file2.txt'
    })
    .reply(201, {
      sha: 'new-tree-sha',
    })
    .post('/repos/test-owner/test-repo/git/commits', (body: any) => {
      return body.message === 'Test commit' && body.tree === 'new-tree-sha' && body.parents[0] === 'base-sha'
    })
    .reply(201, {
      sha: 'new-commit-sha',
    })
    .patch('/repos/test-owner/test-repo/git/refs/heads%2Ftest-branch', {
      sha: 'new-commit-sha',
    })
    .reply(200, {
      ref: 'refs/heads/test-branch',
    })

  const result = await commitFiles({
    branchName: 'test-branch',
    commitMessage: 'Test commit',
    files: [
      {
        content: 'content 1',
        path: 'file1.txt',
      },
      {
        content: 'content 2',
        path: 'file2.txt',
      },
    ],
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    commitSha: 'new-commit-sha',
  })
  expect(scope.isDone()).toBe(true)
})

test('returns undefined when no files provided', async (): Promise<void> => {
  const result = await commitFiles({
    branchName: 'test-branch',
    commitMessage: 'Test commit',
    files: [],
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toBeUndefined()
})

test('handles custom file mode and type', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Ftest-branch')
    .reply(200, {
      object: {
        sha: 'base-sha',
      },
    })
    .get('/repos/test-owner/test-repo/git/commits/base-sha')
    .reply(200, {
      sha: 'base-sha',
      tree: {
        sha: 'base-tree-sha',
      },
    })
    .post('/repos/test-owner/test-repo/git/trees', (body: any) => {
      return body.tree[0].mode === '100644' && body.tree[0].type === 'blob'
    })
    .reply(201, {
      sha: 'new-tree-sha',
    })
    .post('/repos/test-owner/test-repo/git/commits', {
      message: 'Test commit',
      parents: ['base-sha'],
      tree: 'new-tree-sha',
    })
    .reply(201, {
      sha: 'new-commit-sha',
    })
    .patch('/repos/test-owner/test-repo/git/refs/heads%2Ftest-branch', {
      sha: 'new-commit-sha',
    })
    .reply(200, {
      ref: 'refs/heads/test-branch',
    })

  const result = await commitFiles({
    branchName: 'test-branch',
    commitMessage: 'Test commit',
    files: [
      {
        content: 'content',
        mode: '100644',
        path: 'file.txt',
        type: 'blob',
      },
    ],
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    commitSha: 'new-commit-sha',
  })
  expect(scope.isDone()).toBe(true)
})

test('throws error when branch not found', async (): Promise<void> => {
  const scope = nock('https://api.github.com').get('/repos/test-owner/test-repo/git/ref/heads%2Fnonexistent').reply(404, {
    message: 'Not Found',
  })

  await expect(
    commitFiles({
      branchName: 'nonexistent',
      commitMessage: 'Test commit',
      files: [
        {
          content: 'content',
          path: 'file.txt',
        },
      ],
      githubToken: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    }),
  ).rejects.toThrow()

  expect(scope.isDone()).toBe(true)
})
