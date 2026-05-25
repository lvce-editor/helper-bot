import { expect, test } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { modernizeBranchProtection } from '../src/parts/ModernizeBranchProtection/ModernizeBranchProtection.ts'

test('returns a declarative repo command for the default branch', async (): Promise<void> => {
  const result = await modernizeBranchProtection({
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      branch: 'main',
      message: 'Queued branch protection modernization',
    },
    pullRequestTitle: '',
    repoCommands: [
      {
        branch: 'main',
        type: 'modernize-branch-protection',
      },
    ],
    status: 'success',
    statusCode: 200,
  })
})

test('uses the provided branch in the repo command', async (): Promise<void> => {
  const result = await modernizeBranchProtection({
    branch: 'develop',
    clonedRepoUri: 'file:///tmp/test',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch,
    fs: FsPromises as any,
    githubToken: 'test-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    changedFiles: [],
    data: {
      branch: 'develop',
      message: 'Queued branch protection modernization',
    },
    pullRequestTitle: '',
    repoCommands: [
      {
        branch: 'develop',
        type: 'modernize-branch-protection',
      },
    ],
    status: 'success',
    statusCode: 200,
  })
})