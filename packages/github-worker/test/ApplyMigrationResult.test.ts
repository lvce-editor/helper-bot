import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'
import nock from 'nock'
import { applyMigrationResult } from '../src/parts/ApplyMigrationResult/ApplyMigrationResult.ts'

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

test('applies migration result successfully with file changes', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
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
    .get('/repos/test-owner/test-repo/contents/file1.txt')
    .query({ ref: 'main' })
    .reply(200, {
      content: Buffer.from('old content').toString('base64'),
      sha: 'old-sha',
    })
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/heads/migration-branch',
      sha: 'base-sha',
    })
    .reply(201, {
      ref: 'refs/heads/migration-branch',
    })
    .post('/repos/test-owner/test-repo/git/trees', (body: any) => {
      return body.base_tree === 'base-tree-sha' && body.tree.length === 1 && body.tree[0].path === 'file1.txt'
    })
    .reply(201, {
      sha: 'new-tree-sha',
    })
    .post('/repos/test-owner/test-repo/git/commits', (body: any) => {
      return body.message === 'Test commit message' && body.tree === 'new-tree-sha' && body.parents[0] === 'base-sha'
    })
    .reply(201, {
      sha: 'new-commit-sha',
    })
    .patch('/repos/test-owner/test-repo/git/refs/heads%2Fmigration-branch', {
      sha: 'new-commit-sha',
    })
    .reply(200, {
      ref: 'refs/heads/migration-branch',
    })
    .post('/repos/test-owner/test-repo/pulls', {
      base: 'main',
      head: 'migration-branch',
      title: 'Test PR Title',
    })
    .reply(201, {
      node_id: 'PR_node_id_123',
      number: 123,
    })
    .post('/graphql', (body: any) => {
      return body.query.includes('enablePullRequestAutoMerge') && body.variables === undefined
    })
    .reply(200, {
      data: {
        enablePullRequestAutoMerge: {
          clientMutationId: null,
        },
      },
    })

  const result = await applyMigrationResult({
    baseBranch: 'main',
    branchName: 'migration-branch',
    changedFiles: [
      {
        content: 'new content',
        path: 'file1.txt',
        type: 'updated',
      },
    ],
    commitMessage: 'Test commit message',
    githubToken: 'test-token',
    owner: 'test-owner',
    pullRequestTitle: 'Test PR Title',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    branchName: 'migration-branch',
    changedFiles: 1,
    message: 'Migration completed successfully',
    pullRequestNumber: 123,
    status: 'success',
  })
  expect(scope.isDone()).toBe(true)
})

test('returns undefined when no changed files', async (): Promise<void> => {
  const result = await applyMigrationResult({
    baseBranch: 'main',
    branchName: 'migration-branch',
    changedFiles: [],
    commitMessage: 'Test commit message',
    githubToken: 'test-token',
    owner: 'test-owner',
    pullRequestTitle: 'Test PR Title',
    repo: 'test-repo',
  })

  expect(result).toBeUndefined()
})

test('handles file creation', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
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
    .get('/repos/test-owner/test-repo/contents/new-file.txt')
    .query({ ref: 'main' })
    .reply(404, {
      message: 'Not Found',
    })
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/heads/migration-branch',
      sha: 'base-sha',
    })
    .reply(201, {
      ref: 'refs/heads/migration-branch',
    })
    .post('/repos/test-owner/test-repo/git/trees', (body: any) => {
      return body.base_tree === 'base-tree-sha' && body.tree.length === 1 && body.tree[0].path === 'new-file.txt'
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
    .patch('/repos/test-owner/test-repo/git/refs/heads%2Fmigration-branch', {
      sha: 'new-commit-sha',
    })
    .reply(200, {
      ref: 'refs/heads/migration-branch',
    })
    .post('/repos/test-owner/test-repo/pulls', {
      base: 'main',
      head: 'migration-branch',
      title: 'Test PR',
    })
    .reply(201, {
      node_id: 'PR_node_id_456',
      number: 456,
    })
    .post('/graphql')
    .reply(200, {
      data: {
        enablePullRequestAutoMerge: {
          clientMutationId: null,
        },
      },
    })

  const result = await applyMigrationResult({
    baseBranch: 'main',
    branchName: 'migration-branch',
    changedFiles: [
      {
        content: 'new file content',
        path: 'new-file.txt',
        type: 'created',
      },
    ],
    commitMessage: 'Test commit',
    githubToken: 'test-token',
    owner: 'test-owner',
    pullRequestTitle: 'Test PR',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    branchName: 'migration-branch',
    changedFiles: 1,
    message: 'Migration completed successfully',
    pullRequestNumber: 456,
    status: 'success',
  })
  expect(scope.isDone()).toBe(true)
})

test('handles file deletion', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
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
    .get('/repos/test-owner/test-repo/contents/file-to-delete.txt')
    .query({ ref: 'main' })
    .reply(200, {
      content: Buffer.from('content').toString('base64'),
      sha: 'file-sha',
    })
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/heads/migration-branch',
      sha: 'base-sha',
    })
    .reply(201, {
      ref: 'refs/heads/migration-branch',
    })
    .get('/repos/test-owner/test-repo/git/trees/base-tree-sha')
    .query({ recursive: 1 })
    .reply(200, {
      tree: [
        {
          mode: '100644',
          path: 'file-to-delete.txt',
          sha: 'file-sha',
          type: 'blob',
        },
        {
          mode: '100644',
          path: 'other-file.txt',
          sha: 'other-sha',
          type: 'blob',
        },
      ],
    })
    .post('/repos/test-owner/test-repo/git/trees', (body: any) => {
      return body.base_tree === 'base-tree-sha' && body.tree.length === 1 && body.tree[0].path === 'other-file.txt'
    })
    .reply(201, {
      sha: 'new-tree-sha',
    })
    .post('/repos/test-owner/test-repo/git/commits', {
      message: 'Delete file',
      parents: ['base-sha'],
      tree: 'new-tree-sha',
    })
    .reply(201, {
      sha: 'new-commit-sha',
    })
    .patch('/repos/test-owner/test-repo/git/refs/heads%2Fmigration-branch', {
      sha: 'new-commit-sha',
    })
    .reply(200, {
      ref: 'refs/heads/migration-branch',
    })
    .post('/repos/test-owner/test-repo/pulls', {
      base: 'main',
      head: 'migration-branch',
      title: 'Delete file',
    })
    .reply(201, {
      node_id: 'PR_node_id_789',
      number: 789,
    })
    .post('/graphql')
    .reply(200, {
      data: {
        enablePullRequestAutoMerge: {
          clientMutationId: null,
        },
      },
    })

  const result = await applyMigrationResult({
    baseBranch: 'main',
    branchName: 'migration-branch',
    changedFiles: [
      {
        content: '',
        path: 'file-to-delete.txt',
        type: 'deleted',
      },
    ],
    commitMessage: 'Delete file',
    githubToken: 'test-token',
    owner: 'test-owner',
    pullRequestTitle: 'Delete file',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    branchName: 'migration-branch',
    changedFiles: 1,
    message: 'Migration completed successfully',
    pullRequestNumber: 789,
    status: 'success',
  })
  expect(scope.isDone()).toBe(true)
})

test('skips unchanged files', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
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
    .get('/repos/test-owner/test-repo/contents/file1.txt')
    .query({ ref: 'main' })
    .reply(200, {
      content: Buffer.from('same content').toString('base64'),
      sha: 'file-sha',
    })

  const result = await applyMigrationResult({
    baseBranch: 'main',
    branchName: 'migration-branch',
    changedFiles: [
      {
        content: 'same content',
        path: 'file1.txt',
        type: 'updated',
      },
    ],
    commitMessage: 'Test commit',
    githubToken: 'test-token',
    owner: 'test-owner',
    pullRequestTitle: 'Test PR',
    repo: 'test-repo',
  })

  expect(result).toBeUndefined()
  expect(scope.isDone()).toBe(true)
})

test('handles multiple files', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
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
    .get('/repos/test-owner/test-repo/contents/file1.txt')
    .query({ ref: 'main' })
    .reply(200, {
      content: Buffer.from('old content 1').toString('base64'),
      sha: 'sha1',
    })
    .get('/repos/test-owner/test-repo/contents/file2.txt')
    .query({ ref: 'main' })
    .reply(404, {
      message: 'Not Found',
    })
    .post('/repos/test-owner/test-repo/git/refs', {
      ref: 'refs/heads/migration-branch',
      sha: 'base-sha',
    })
    .reply(201, {
      ref: 'refs/heads/migration-branch',
    })
    .post('/repos/test-owner/test-repo/git/trees', (body: any) => {
      return body.base_tree === 'base-tree-sha' && body.tree.length === 2
    })
    .reply(201, {
      sha: 'new-tree-sha',
    })
    .post('/repos/test-owner/test-repo/git/commits', {
      message: 'Multiple files',
      parents: ['base-sha'],
      tree: 'new-tree-sha',
    })
    .reply(201, {
      sha: 'new-commit-sha',
    })
    .patch('/repos/test-owner/test-repo/git/refs/heads%2Fmigration-branch', {
      sha: 'new-commit-sha',
    })
    .reply(200, {
      ref: 'refs/heads/migration-branch',
    })
    .post('/repos/test-owner/test-repo/pulls', {
      base: 'main',
      head: 'migration-branch',
      title: 'Multiple files',
    })
    .reply(201, {
      node_id: 'PR_node_id_999',
      number: 999,
    })
    .post('/graphql')
    .reply(200, {
      data: {
        enablePullRequestAutoMerge: {
          clientMutationId: null,
        },
      },
    })

  const result = await applyMigrationResult({
    baseBranch: 'main',
    branchName: 'migration-branch',
    changedFiles: [
      {
        content: 'new content 1',
        path: 'file1.txt',
        type: 'updated',
      },
      {
        content: 'new content 2',
        path: 'file2.txt',
        type: 'created',
      },
    ],
    commitMessage: 'Multiple files',
    githubToken: 'test-token',
    owner: 'test-owner',
    pullRequestTitle: 'Multiple files',
    repo: 'test-repo',
  })

  expect(result).toEqual({
    branchName: 'migration-branch',
    changedFiles: 2,
    message: 'Migration completed successfully',
    pullRequestNumber: 999,
    status: 'success',
  })
  expect(scope.isDone()).toBe(true)
})

test('uses default branch name when not provided', async (): Promise<void> => {
  const scope = nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/git/ref/heads%2Fmain')
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
    .get('/repos/test-owner/test-repo/contents/file1.txt')
    .query({ ref: 'main' })
    .reply(404, {
      message: 'Not Found',
    })
    .post('/repos/test-owner/test-repo/git/refs', (body: any) => {
      return body.ref.startsWith('refs/heads/migration-') && body.sha === 'base-sha'
    })
    .reply(201, {
      ref: 'refs/heads/migration-1234567890',
    })
    .post('/repos/test-owner/test-repo/git/trees', {
      base_tree: 'base-tree-sha',
      tree: [
        {
          content: 'new content',
          mode: '100644',
          path: 'file1.txt',
          type: 'blob',
        },
      ],
    })
    .reply(201, {
      sha: 'new-tree-sha',
    })
    .post('/repos/test-owner/test-repo/git/commits', {
      message: 'Test PR Title',
      parents: ['base-sha'],
      tree: 'new-tree-sha',
    })
    .reply(201, {
      sha: 'new-commit-sha',
    })
    .patch(/\/repos\/test-owner\/test-repo\/git\/refs\/heads%2Fmigration-\d+/, {
      sha: 'new-commit-sha',
    })
    .reply(200, {
      ref: 'refs/heads/migration-1234567890',
    })
    .post('/repos/test-owner/test-repo/pulls', (body: any) => {
      return body.base === 'main' && body.head.match(/^migration-\d+$/) && body.title === 'Test PR Title'
    })
    .reply(201, {
      node_id: 'PR_node_id_111',
      number: 111,
    })
    .post('/graphql')
    .reply(200, {
      data: {
        enablePullRequestAutoMerge: {
          clientMutationId: null,
        },
      },
    })

  const result = await applyMigrationResult({
    baseBranch: 'main',
    changedFiles: [
      {
        content: 'new content',
        path: 'file1.txt',
        type: 'created',
      },
    ],
    commitMessage: 'Test PR Title',
    githubToken: 'test-token',
    owner: 'test-owner',
    pullRequestTitle: 'Test PR Title',
    repo: 'test-repo',
  })

  expect(result).toBeDefined()
  expect(result?.branchName).toMatch(/^migration-\d+$/)
  expect(result?.changedFiles).toBe(1)
  expect(scope.isDone()).toBe(true)
})
