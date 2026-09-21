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
    calls: 3,
    failures: 2,
    message: 'npm error code ETARGET\nnpm error notarget No matching version found for @lvce-editor/extension-detail-view@^7.47.0.',
    status: 'success',
  },
  {
    calls: 5,
    failures: Infinity,
    message: 'npm error code ETARGET\nnpm error notarget No matching version found for @lvce-editor/extension-detail-view@^7.47.0.',
    status: 'error',
  },
  { calls: 1, failures: Infinity, message: 'npm error code ERESOLVE', status: 'error' },
  {
    calls: 1,
    failures: Infinity,
    message: 'npm error code ETARGET\nnpm error notarget No matching version found for @lvce-editor/other@^1.0.0.',
    status: 'error',
  },
])('handles npm failures with $calls attempts and $status: $message', async ({ calls, failures, message, status }) => {
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
  expect(result.changedFiles).toHaveLength(status === 'success' ? 2 : 0)
  expect('errorMessage' in result ? result.errorMessage : '').toBe(status === 'error' ? `Failed to update dependencies: ${message}` : '')
})

test.each([true, false])('updates the workspace root lockfile with nested lockfile present: %s', async (nestedLockfile) => {
  const clonedRepoUri = pathToUri('/test/workspace/')
  const packageJsonPath = 'modules/renderer/package.json'
  const originalFiles: Record<string, string> = {
    'modules/sibling/package.json': '{"name":"sibling"}',
    'package-lock.json': '{"oldRootLock":true}',
    'package.json': JSON.stringify({ name: 'root', workspaces: ['modules/*', 'tools/*/packages/*'] }),
    [packageJsonPath]: JSON.stringify({ dependencies: { '@lvce-editor/shared': '^1.0.0' }, name: 'renderer' }),
    'tools/nested/packages/other/package-lock.json': '{"otherLock":true}',
    'tools/nested/packages/other/package.json': '{"name":"other"}',
  }
  if (nestedLockfile) {
    originalFiles['modules/renderer/package-lock.json'] = '{"staleNestedLock":true}'
  }
  const mockFs = createMockFs({
    files: Object.fromEntries(
      Object.entries({ ...originalFiles, '.git/package.json': '{}', 'node_modules/ignored/package.json': '{}', 'src/index.js': 'ignored' }).map(
        ([path, content]) => [resolveUri(path, clonedRepoUri), content],
      ),
    ),
  })
  let temporaryRoot = ''
  const exec = createMockExec(async (_file, _args, options) => {
    temporaryRoot = options!.cwd!
    expect(temporaryRoot.endsWith('/')).toBe(true)
    for (const [path, content] of Object.entries(originalFiles)) {
      const copied = await mockFs.readFile(resolveUri(path, temporaryRoot), 'utf8')
      const expected = path === packageJsonPath ? { dependencies: { '@lvce-editor/shared': '^2.0.0' }, name: 'renderer' } : JSON.parse(content)
      expect(JSON.parse(copied)).toEqual(expected)
    }
    for (const path of ['node_modules/ignored/package.json', '.git/package.json', 'src/index.js']) {
      await expect(mockFs.readFile(resolveUri(path, temporaryRoot), 'utf8')).rejects.toThrow('ENOENT')
    }
    await mockFs.writeFile(resolveUri('package-lock.json', temporaryRoot), '{"updatedRootLock":true}')
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const result = await getNewPackageFiles({
    clonedRepoUri,
    dependencyKey: 'dependencies',
    dependencyName: 'shared',
    exec,
    fetch: globalThis.fetch,
    fs: mockFs,
    newVersion: '2.0.0',
    packageJsonPath,
    packageLockJsonPath: 'modules/renderer/package-lock.json',
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })
  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual(
    expect.arrayContaining([
      { content: '{"updatedRootLock":true}', path: 'package-lock.json' },
      { content: expect.stringContaining('^2.0.0'), path: packageJsonPath },
    ]),
  )
  expect(result.changedFiles).toHaveLength(2)
  for (const [path, content] of Object.entries(originalFiles)) {
    expect(await mockFs.readFile(resolveUri(path, clonedRepoUri), 'utf8')).toBe(content)
  }
  await expect(mockFs.readFile(resolveUri('package.json', temporaryRoot), 'utf8')).rejects.toThrow('ENOENT')
})
