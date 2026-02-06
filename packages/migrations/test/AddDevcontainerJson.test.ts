import { test, expect } from '@jest/globals'
import { addDevcontainerJson } from '../src/parts/AddDevcontainerJson/AddDevcontainerJson.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('creates devcontainer.json when it does not exist', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {},
  })

  const result = await addDevcontainerJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.branchName).toBe('feature/add-dev-container')
  expect(result.commitMessage).toBe('chore: add dev container configuration')
  expect(result.pullRequestTitle).toBe('chore: add dev container configuration')
  expect(result.changedFiles).toHaveLength(1)

  const changedFile = result.changedFiles[0]
  expect(changedFile.path).toBe('.devcontainer/devcontainer.json')

  const content = JSON.parse(changedFile.content)
  expect(content).toEqual({
    customizations: {
      vscode: {
        extensions: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'],
      },
    },
    forwardPorts: [3000],
    image: 'mcr.microsoft.com/devcontainers/node:24',
    name: 'text-search-worker',
    postCreateCommand: 'npm ci',
    postStartCommand: 'npm run dev',
    remoteUser: 'node',
  })
})

test('returns empty result when devcontainer.json already exists', async () => {
  const devcontainerContent = JSON.stringify({
    image: 'mcr.microsoft.com/devcontainers/node:24',
    name: 'existing',
  })

  const clonedRepoUri = pathToUri('/test/repo')
  const devcontainerPath = new URL('.devcontainer/devcontainer.json', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [devcontainerPath]: devcontainerContent,
    },
  })

  const result = await addDevcontainerJson({
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
