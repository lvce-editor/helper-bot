import { test, expect, jest } from '@jest/globals'
import { addEslint } from '../src/parts/AddEslint/AddEslint.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('adds eslint and @lvce-editor/eslint-config to devDependencies', async () => {
  const oldPackageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/eslint-config': {
          version: '1.0.0',
        },
        eslint: {
          version: '9.0.0',
        },
      },
      lockfileVersion: 3,
      name: 'test-package',
      version: '1.0.0',
    },
    null,
    2,
  )

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(new URL('package-lock.json', cwd).toString(), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await addEslint({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/add-eslint',
    changedFiles: [
      {
        content: expect.stringContaining('"eslint": "latest"'),
        path: 'package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'package-lock.json',
      },
    ],
    commitMessage: 'chore: add eslint and @lvce-editor/eslint-config',
    pullRequestTitle: 'chore: add eslint and @lvce-editor/eslint-config',
    status: 'success',
    statusCode: 200,
  })

  expect(result.changedFiles[0].content).toContain('"@lvce-editor/eslint-config": "latest"')
  expect(mockExecFn).toHaveBeenCalledTimes(1)
  expect(mockExecFn).toHaveBeenCalledWith(
    'npm',
    [
      'install',
      '--save-dev',
      'eslint',
      '@lvce-editor/eslint-config',
      '--ignore-scripts',
      '--prefer-online',
      '--cache',
      expect.stringMatching(/add-eslint-test-package-tmp-cache/),
    ],
    {
      cwd: expect.stringMatching(/add-eslint-test-package-tmp$/),
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

  const result = await addEslint({
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
  expect(mockExecFn).not.toHaveBeenCalled()
})

test('skips if eslint already exists in devDependencies', async () => {
  const oldPackageJson = {
    devDependencies: {
      eslint: '^9.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await addEslint({
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
  expect(mockExecFn).not.toHaveBeenCalled()
})

test('adds eslint when devDependencies exists but eslint is not present', async () => {
  const oldPackageJson = {
    devDependencies: {
      typescript: '^5.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/eslint-config': {
          version: '1.0.0',
        },
        eslint: {
          version: '9.0.0',
        },
      },
      lockfileVersion: 3,
      name: 'test-package',
      version: '1.0.0',
    },
    null,
    2,
  )

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(new URL('package-lock.json', cwd).toString(), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await addEslint({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/add-eslint',
    changedFiles: [
      {
        content: expect.stringContaining('"eslint": "latest"'),
        path: 'package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'package-lock.json',
      },
    ],
    commitMessage: 'chore: add eslint and @lvce-editor/eslint-config',
    pullRequestTitle: 'chore: add eslint and @lvce-editor/eslint-config',
    status: 'success',
    statusCode: 200,
  })

  expect(result.changedFiles[0].content).toContain('"@lvce-editor/eslint-config": "latest"')
  expect(result.changedFiles[0].content).toContain('"typescript": "^5.0.0"')
  expect(mockExecFn).toHaveBeenCalledTimes(1)
})
