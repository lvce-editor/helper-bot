import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { modernizeTypescript } from '../src/parts/ModernizeTypescript/ModernizeTypescript.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('skips when package.json does not exist', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('exec should not be called')
  })

  const result = await modernizeTypescript({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
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

  expect(mockExecFn).not.toHaveBeenCalled()
})

test('skips when typescript is not in root package.json', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify({ name: 'test' }, null, 2) + '\n',
    },
  })
  const mockExecFn = jest.fn(async () => {
    throw new Error('exec should not be called')
  })

  const result = await modernizeTypescript({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
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

  expect(mockExecFn).not.toHaveBeenCalled()
})

test('skips when typescript major version is already 6 or higher', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(
        {
          devDependencies: {
            typescript: '^6.0.0',
          },
          name: 'test',
        },
        null,
        2,
      ),
    },
  })
  const mockExecFn = jest.fn(async () => {
    throw new Error('exec should not be called')
  })

  const result = await modernizeTypescript({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
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

  expect(mockExecFn).not.toHaveBeenCalled()
})

test('updates typescript to version 6 when current major is lower', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJsonPath = new URL('package.json', clonedRepoUri).toString()
  const packageLockPath = new URL('package-lock.json', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [packageJsonPath]: JSON.stringify(
        {
          devDependencies: {
            typescript: '^5.9.3',
          },
          name: 'test',
        },
        null,
        2,
      ),
    },
  })

  const mockExecFn = jest.fn(async (file: string, args?: readonly string[], options?: { cwd?: string }) => {
    if (file === 'npm' && args?.join(' ') === 'install typescript@6' && options?.cwd === clonedRepoUri) {
      await mockFs.writeFile(
        packageJsonPath,
        JSON.stringify(
          {
            devDependencies: {
              typescript: '^6.0.0',
            },
            name: 'test',
          },
          null,
          2,
        ) + '\n',
      )
      await mockFs.writeFile(packageLockPath, '{"name":"test"}\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })

  const result = await modernizeTypescript({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-typescript',
    changedFiles: [
      {
        content: `{
  "devDependencies": {
    "typescript": "^6.0.0"
  },
  "name": "test"
}\n`,
        path: 'package.json',
      },
      {
        content: '{"name":"test"}\n',
        path: 'package-lock.json',
      },
    ],
    commitMessage: 'ci: modernize typescript to v6',
    pullRequestTitle: 'ci: modernize typescript to v6',
    status: 'success',
    statusCode: 201,
  })

  expect(mockExecFn).toHaveBeenCalledTimes(1)
  expect(mockExecFn).toHaveBeenCalledWith('npm', ['install', 'typescript@6'], { cwd: clonedRepoUri })
})
