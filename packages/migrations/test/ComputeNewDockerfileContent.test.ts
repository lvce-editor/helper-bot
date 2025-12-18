import { test, expect } from '@jest/globals'
import { computeNewDockerfileContent } from '../src/parts/ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
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

test('updates node version in Dockerfile', async () => {
  const content = `FROM node:18.0.0
WORKDIR /app
COPY . .
RUN npm install`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('Dockerfile', clonedRepoUri).toString()]: content,
    },
  })

  const result = await computeNewDockerfileContent({
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
        content: `FROM node:20.0.0
WORKDIR /app
COPY . .
RUN npm install`,
        path: 'Dockerfile',
      },
    ],
    commitMessage: 'ci: update Node.js to version v20.0.0',
    pullRequestTitle: 'ci: update Node.js to version v20.0.0',
    status: 'success',
    statusCode: 200,
  })
})

test('returns same content when no node version found', async () => {
  const content = `FROM alpine:latest
WORKDIR /app
COPY . .`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('Dockerfile', clonedRepoUri).toString()]: content,
    },
  })

  const result = await computeNewDockerfileContent({
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

test('handles missing Dockerfile', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await computeNewDockerfileContent({
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
