import { test, expect } from '@jest/globals'
import { addEslintConfig } from '../src/parts/AddEslintConfig/AddEslintConfig.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('creates eslint.config.js when it does not exist', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await addEslintConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/add-eslint-config',
    changedFiles: [
      {
        content: `import * as config from '@lvce-editor/eslint-config'
import * as actions from '@lvce-editor/eslint-plugin-github-actions'

export default [...config.default, ...actions.default]
`,
        path: 'eslint.config.js',
      },
    ],
    commitMessage: 'feature: add eslint.config.js',
    pullRequestTitle: 'feature: add eslint.config.js',
    status: 'success',
    statusCode: 200,
  })
})

test('skips if eslint.config.js already exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('eslint.config.js', clonedRepoUri).toString()]: 'existing config',
    },
  })
  const mockExec = createMockExec()

  const result = await addEslintConfig({
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
