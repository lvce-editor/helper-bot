import { afterEach, test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { getNewPackageFiles } from '../src/parts/GetNewPackageFiles/GetNewPackageFiles.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

test('generates new package files with updated dependency', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/shared': '^1.0.0',
    },
    name: '@lvce-editor/renderer-worker',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/shared': {
          version: '2.0.0',
        },
      },
      lockfileVersion: 3,
      name: '@lvce-editor/renderer-worker',
      version: '1.0.0',
    },
    null,
    2,
  )

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      // Write a mock package-lock.json after npm install
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(resolveUri('package-lock.json', cwd), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await getNewPackageFiles({
    clonedRepoUri,
    dependencyKey: 'dependencies',
    dependencyName: 'shared',
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    newVersion: '2.0.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/update-shared-to-2.0.0',
    changedFiles: [
      {
        content: `{
  "dependencies": {
    "@lvce-editor/shared": "^2.0.0"
  },
  "name": "@lvce-editor/renderer-worker",
  "version": "1.0.0"
}
`,
        path: 'package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'package-lock.json',
      },
    ],
    commitMessage: 'feature: update shared to version 2.0.0',
    pullRequestTitle: 'feature: update shared to version 2.0.0',
    status: 'success',
    statusCode: 201,
  })

  expect(mockExecFn).toHaveBeenCalledTimes(1)
  expect(mockExecFn).toHaveBeenCalledWith(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--prefer-online',
      '--cache',
      expect.stringMatching(/update-dependencies-lvce-editor-renderer-worker-shared-2\.0\.0-tmp-cache-/),
    ],
    {
      cwd: expect.stringMatching(/update-dependencies-lvce-editor-renderer-worker-shared-2\.0\.0-tmp-/),
    },
  )
})

test('handles missing package.json', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await getNewPackageFiles({
    clonedRepoUri,
    dependencyKey: 'dependencies',
    dependencyName: 'test-dependency',
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    newVersion: '2.0.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
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

afterEach(() => {
  jest.useRealTimers()
})

test.each([
  {
    failures: 2,
    message: 'npm error code ETARGET\nnpm error notarget No matching version found for @lvce-editor/extension-detail-view@^7.47.0.',
    calls: 3,
    status: 'success',
  },
  {
    failures: Infinity,
    message: 'npm error code ETARGET\nnpm error notarget No matching version found for @lvce-editor/extension-detail-view@^7.47.0.',
    calls: 5,
    status: 'error',
  },
  { failures: Infinity, message: 'npm error code ERESOLVE', calls: 1, status: 'error' },
  {
    failures: Infinity,
    message: 'npm error code ETARGET\nnpm error notarget No matching version found for @lvce-editor/other@^1.0.0.',
    calls: 1,
    status: 'error',
  },
])('handles npm failures with $calls attempts and $status: $message', async ({ failures, message, calls, status }) => {
  jest.useFakeTimers()
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify({ dependencies: { '@lvce-editor/extension-detail-view': '^7.45.0' } }),
    },
  })
  let attempts = 0
  const mockExecFn = jest.fn(async (_file: string, _args?: readonly string[], options?: { cwd?: string }) => {
    attempts++
    if (attempts <= failures) {
      throw new Error(message)
    }
    await mockFs.writeFile(resolveUri('package-lock.json', options!.cwd!), '{"lockfileVersion":3}\n')
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const pending = getNewPackageFiles({
    clonedRepoUri,
    dependencyKey: 'dependencies',
    dependencyName: 'extension-detail-view',
    exec: createMockExec(mockExecFn),
    fetch: globalThis.fetch,
    fs: mockFs,
    newVersion: '7.47.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
    repositoryName: 'lvce-editor',
    repositoryOwner: 'lvce-editor',
  })
  await jest.runAllTimersAsync()
  const result = await pending
  expect(mockExecFn).toHaveBeenCalledTimes(calls)
  expect(result.status).toBe(status)
  if (status === 'success') {
    expect(result.changedFiles).toContainEqual({ path: 'package-lock.json', content: '{"lockfileVersion":3}\n' })
  } else {
    expect(result.changedFiles).toEqual([])
    expect(result).toEqual(expect.objectContaining({ errorMessage: expect.stringContaining(message) }))
  }
})
