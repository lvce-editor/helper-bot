import { test, expect } from '@jest/globals'
import { computeNewNvmrcContent } from '../src/parts/ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFetch } from '../src/parts/CreateMockFetch/CreateMockFetch.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()
const mockFetch = createMockFetch([
  { lts: 'Iron', version: 'v20.0.0' },
  { lts: false, version: 'v19.0.0' },
  { lts: 'Hydrogen', version: 'v18.0.0' },
])

test('computes new nvmrc content when version should be updated', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.nvmrc', clonedRepoUri).toString()]: 'v18.0.0',
    },
  })

  const result = await computeNewNvmrcContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-node-version',
    changedFiles: [
      {
        content: 'v20.0.0\n',
        path: '.nvmrc',
      },
    ],
    commitMessage: 'ci: update Node.js to version v20.0.0',
    pullRequestTitle: 'ci: update Node.js to version v20.0.0',
    status: 'success',
    statusCode: 200,
  })
})

test('returns same content when existing version is newer', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.nvmrc', clonedRepoUri).toString()]: 'v22.0.0',
    },
  })

  const result = await computeNewNvmrcContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
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

test('handles missing .nvmrc file', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await computeNewNvmrcContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
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
