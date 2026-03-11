import { test, expect, jest } from '@jest/globals'
import type { MigrationErrorResult } from '../src/parts/Types/Types.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updatePackageLockFile } from '../src/parts/UpdatePackageLockFile/UpdatePackageLockFile.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('updates top-level package-lock.json with npm install --ignore-scripts', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package-lock.json', clonedRepoUri).toString()]: '{"lockfileVersion": 3}\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.join(' ') === 'install --ignore-scripts' && options?.cwd === clonedRepoUri) {
      await mockFs.writeFile(new URL('package-lock.json', clonedRepoUri).toString(), '{"lockfileVersion": 3, "updated": true}\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })

  const result = await updatePackageLockFile({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-package-lock-file',
    changedFiles: [
      {
        content: '{"lockfileVersion": 3, "updated": true}\n',
        path: 'package-lock.json',
      },
    ],
    commitMessage: 'chore: update package-lock.json',
    pullRequestTitle: 'chore: update package-lock.json',
    status: 'success',
    statusCode: 201,
  })

  expect(mockExecFn).toHaveBeenCalledTimes(1)
  expect(mockExecFn).toHaveBeenCalledWith('npm', ['install', '--ignore-scripts'], { cwd: clonedRepoUri })
})

test('returns empty result when package-lock.json stays unchanged', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const packageLockContent = '{"lockfileVersion": 3}\n'
  const mockFs = createMockFs({
    files: {
      [new URL('package-lock.json', clonedRepoUri).toString()]: packageLockContent,
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.join(' ') === 'install --ignore-scripts' && options?.cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })

  const result = await updatePackageLockFile({
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
})

test('returns error result when npm install fails', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package-lock.json', clonedRepoUri).toString()]: '{"lockfileVersion": 3}\n',
    },
  })

  const mockExecFn = jest.fn(async () => {
    throw new Error('npm install failed')
  })

  const result = await updatePackageLockFile({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  const errorResult: MigrationErrorResult = result as MigrationErrorResult
  expect(errorResult.errorCode).toBe('UPDATE_PACKAGE_LOCK_FILE_FAILED')
  expect(errorResult.errorMessage).toContain('npm install failed')
  expect(errorResult.changedFiles).toEqual([])
})
