import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { removeGitpodSection } from '../src/parts/RemoveGitpodSection/RemoveGitpodSection.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('removes Gitpod section from README', async () => {
  const content = `# My Project

This is a great project.

## Gitpod

[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/owner/repo)

This project is ready to be developed in Gitpod.

## Installation

Follow these steps to install the project.

## Usage

Here's how to use the project.`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('README.md', clonedRepoUri).toString()]: content,
    },
  })

  const result = await removeGitpodSection({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod-section',
    changedFiles: [
      {
        content: `# My Project

This is a great project.

## Installation

Follow these steps to install the project.

## Usage

Here's how to use the project.`,
        path: 'README.md',
      },
    ],
    commitMessage: 'feature: remove Gitpod section from README',
    pullRequestTitle: 'feature: remove Gitpod section from README',
    status: 'success',
    statusCode: 200,
  })
})

test('returns same content when Gitpod section is not found', async () => {
  const content = `# My Project

This is a great project.

## Installation

Follow these steps to install the project.

## Usage

Here's how to use the project.`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('README.md', clonedRepoUri).toString()]: content,
    },
  })

  const result = await removeGitpodSection({
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

test('only processes README.md', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('README.md', clonedRepoUri).toString()]: `# My Project

## Gitpod

This project is ready to be developed in Gitpod.

## Installation

Follow these steps.`,
      [new URL('readme.md', clonedRepoUri).toString()]: `# Another Project

## Gitpod

Another Gitpod section.

## Usage

Here's how to use it.`,
    },
  })

  const result = await removeGitpodSection({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod-section',
    changedFiles: [
      {
        content: `# My Project

## Installation

Follow these steps.`,
        path: 'README.md',
      },
    ],
    commitMessage: 'feature: remove Gitpod section from README',
    pullRequestTitle: 'feature: remove Gitpod section from README',
    status: 'success',
    statusCode: 200,
  })
})

test('handles missing README files', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await removeGitpodSection({
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
