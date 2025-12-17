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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('README.md')
  expect(result.changedFiles[0].content).not.toContain('## Gitpod')
  expect(result.changedFiles[0].content).not.toContain('Gitpod')
  expect(result.changedFiles[0].content).toContain('## Installation')
  expect(result.changedFiles[0].content).toContain('## Usage')
  expect(result.pullRequestTitle).toBe('ci: remove Gitpod section from README')
  expect(result.branchName).toBe('feature/remove-gitpod-section')
  expect(result.commitMessage).toBe('ci: remove Gitpod section from README')
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe('')
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('README.md')
  expect(result.changedFiles[0].content).not.toContain('Gitpod')
  expect(result.pullRequestTitle).toBe('ci: remove Gitpod section from README')
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
