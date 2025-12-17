import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { initializePackageJson } from '../src/parts/InitializePackageJson/InitializePackageJson.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('creates package.json when it does not exist', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await initializePackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/initialize-package-json',
    changedFiles: [
      {
        content: `{
  "name": "my-repo",
  "version": "1.0.0",
  "description": ""
}
`,
        path: 'package.json',
      },
    ],
    commitMessage: 'chore: initialize package.json',
    pullRequestTitle: 'chore: initialize package.json',
    status: 'success',
    statusCode: 200,
  })
})

test('returns empty result when package.json already exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const existingPackageJson = `{
  "name": "existing-repo",
  "version": "2.0.0",
  "description": "An existing package"
}
`
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: existingPackageJson,
    },
  })

  const result = await initializePackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
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
