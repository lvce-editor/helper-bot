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

  expect(result).toMatchObject({
    branchName: 'feature/add-dev-container-json',
    changedFiles: expect.arrayContaining([
      expect.objectContaining({
        path: '.devcontainer/devcontainer.json',
      }),
    ]),
    commitMessage: 'feature: add dev container configuration',
    pullRequestTitle: 'feature: add dev container configuration',
    status: 'success',
    statusCode: 201,
  })

  const changedFile = result.changedFiles[0]
  const content = JSON.parse(changedFile.content)
  expect(content).toEqual({
    customizations: {
      vscode: {
        extensions: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'],
      },
    },
    features: {},
    forwardPorts: [3000],
    image: 'mcr.microsoft.com/devcontainers/javascript-node:24',
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
