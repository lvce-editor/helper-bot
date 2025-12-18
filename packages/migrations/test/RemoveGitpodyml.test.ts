import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { removeGitpodyml } from '../src/parts/RemoveGitpodyml/RemoveGitpodyml.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('removes .gitpod.yml file when it exists', async () => {
  const gitpodYmlContent = `tasks:
  - init: npm install
    command: npm start

vscode:
  extensions:
    - dbaeumer.vscode-eslint
`

  const clonedRepoUri = pathToUri('/test/repo')
  const gitpodYmlPath = new URL('.gitpod.yml', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [gitpodYmlPath]: gitpodYmlContent,
    },
  })

  const result = await removeGitpodyml({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod-yml',
    changedFiles: [
      {
        content: '',
        path: '.gitpod.yml',
        type: 'deleted',
      },
    ],
    commitMessage: 'ci: remove .gitpod.yml',
    pullRequestTitle: 'ci: remove .gitpod.yml',
    status: 'success',
    statusCode: 201,
  })

  const fileExists = await mockFs.exists(gitpodYmlPath)
  expect(fileExists).toBe(true)
})

test('removes both .gitpod.yml and .gitpod.Dockerfile when both exist', async () => {
  const gitpodYmlContent = `tasks:
  - init: npm install
    command: npm start
`
  const dockerfileContent = `FROM gitpod/workspace-full:latest

RUN npm install -g pnpm
`

  const clonedRepoUri = pathToUri('/test/repo')
  const gitpodYmlPath = new URL('.gitpod.yml', clonedRepoUri).toString()
  const gitpodDockerfilePath = new URL('.gitpod.Dockerfile', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [gitpodDockerfilePath]: dockerfileContent,
      [gitpodYmlPath]: gitpodYmlContent,
    },
  })

  const result = await removeGitpodyml({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod-yml',
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
    ],
    commitMessage: 'ci: remove .gitpod.yml and .gitpod.Dockerfile',
    pullRequestTitle: 'ci: remove .gitpod.yml and .gitpod.Dockerfile',
    status: 'success',
    statusCode: 201,
  })
})

test('removes only .gitpod.Dockerfile when only it exists', async () => {
  const dockerfileContent = `FROM gitpod/workspace-full:latest

RUN npm install -g pnpm
`

  const clonedRepoUri = pathToUri('/test/repo')
  const gitpodDockerfilePath = new URL('.gitpod.Dockerfile', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [gitpodDockerfilePath]: dockerfileContent,
    },
  })

  const result = await removeGitpodyml({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/remove-gitpod-yml',
    changedFiles: [
      {
        content: '',
        path: '.gitpod.Dockerfile',
        type: 'deleted',
      },
    ],
    commitMessage: 'ci: remove .gitpod.Dockerfile',
    pullRequestTitle: 'ci: remove .gitpod.Dockerfile',
    status: 'success',
    statusCode: 201,
  })
})

test('returns empty result when neither .gitpod.yml nor .gitpod.Dockerfile exist', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await removeGitpodyml({
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
