import { expect, test } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { removeGitpod } from '../src/parts/RemoveGitpod/RemoveGitpod.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('removes Gitpod config files and README references', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('.gitpod.Dockerfile', clonedRepoUri)]: 'FROM gitpod/workspace-full:latest\n',
      [resolveUri('.gitpod.yml', clonedRepoUri)]: 'tasks:\n  - init: npm install\n',
      [resolveUri('README.md', clonedRepoUri)]: `# My Project

[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/owner/repo)

This project is ready to be developed in Gitpod.

## Installation

Follow these steps.`,
    },
  })

  const result = await removeGitpod({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod',
    changedFiles: [
      {
        content: '',
        path: '.gitpod.yml',
        type: 'deleted',
      },
      {
        content: '',
        path: '.gitpod.Dockerfile',
        type: 'deleted',
      },
      {
        content: `# My Project

## Installation

Follow these steps.`,
        path: 'README.md',
      },
    ],
    commitMessage: 'ci: remove Gitpod configuration',
    pullRequestTitle: 'ci: remove Gitpod configuration',
    status: 'success',
    statusCode: 201,
  })
})

test('removes Gitpod README sections', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('README.md', clonedRepoUri)]: `# My Project

## Gitpod

[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/owner/repo)

This project is ready to be developed in Gitpod.

## Installation

Follow these steps.`,
    },
  })

  const result = await removeGitpod({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod',
    changedFiles: [
      {
        content: `# My Project

## Installation

Follow these steps.`,
        path: 'README.md',
      },
    ],
    commitMessage: 'ci: remove Gitpod configuration',
    pullRequestTitle: 'ci: remove Gitpod configuration',
    status: 'success',
    statusCode: 201,
  })
})

test('removes Gitpod README section at start of file', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('README.md', clonedRepoUri)]: `## Gitpod

Open this project in Gitpod.

## Installation

Follow these steps.`,
    },
  })

  const result = await removeGitpod({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod',
    changedFiles: [
      {
        content: `## Installation

Follow these steps.`,
        path: 'README.md',
      },
    ],
    commitMessage: 'ci: remove Gitpod configuration',
    pullRequestTitle: 'ci: remove Gitpod configuration',
    status: 'success',
    statusCode: 201,
  })
})

test('returns empty result when no Gitpod files or README references exist', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('README.md', clonedRepoUri)]: '# My Project\n\n## Installation\n\nFollow these steps.\n',
    },
  })

  const result = await removeGitpod({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})
