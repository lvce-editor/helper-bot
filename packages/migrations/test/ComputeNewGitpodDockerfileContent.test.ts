import { test, expect } from '@jest/globals'
import { computeNewGitpodDockerfileContent } from '../src/parts/ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
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

test('updates node version in gitpod dockerfile', async () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0 \\
 && nvm alias default 18.0.0`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('.gitpod.Dockerfile', clonedRepoUri).toString()]: content,
    },
  })

  const result = await computeNewGitpodDockerfileContent({
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
        content: `FROM gitpod/workspace-full
RUN nvm install 20.0.0 \\
 && nvm use 20.0.0 \\
 && nvm alias default 20.0.0`,
        path: '.gitpod.Dockerfile',
      },
    ],
    commitMessage: 'ci: update Node.js to version v20.0.0',
    pullRequestTitle: 'ci: update Node.js to version v20.0.0',
    status: 'success',
    statusCode: 201,
  })
})

test('handles missing .gitpod.Dockerfile', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await computeNewGitpodDockerfileContent({
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
