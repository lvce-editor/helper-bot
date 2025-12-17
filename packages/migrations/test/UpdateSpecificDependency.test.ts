import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateSpecificDependency } from '../src/parts/UpdateSpecificDependency/UpdateSpecificDependency.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('updates dependency successfully', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/test-with-playwright': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/test-with-playwright': {
          version: '2.0.0',
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
      [new URL('packages/e2e/package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
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

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    branchName: expect.any(String),
    changedFiles: [
      {
        content: expect.stringContaining('"@lvce-editor/test-with-playwright": "^2.0.0"'),
        path: 'packages/e2e/package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'packages/e2e/package-lock.json',
      },
    ],
    commitMessage: expect.any(String),
    pullRequestTitle: expect.any(String),
    status: 'success',
    statusCode: 200,
  })
})

test('validates missing fromRepo parameter', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: '',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid or missing fromRepo parameter',
    status: 'error',
    statusCode: 400,
  })
})

test('validates missing toRepo parameter', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: '',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid or missing toRepo parameter',
    status: 'error',
    statusCode: 400,
  })
})

test('validates missing toFolder parameter', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: '',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid or missing toFolder parameter',
    status: 'error',
    statusCode: 400,
  })
})

test('validates missing tagName parameter', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: '',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid or missing tagName parameter',
    status: 'error',
    statusCode: 400,
  })
})

test('validates missing repositoryOwner parameter', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: '',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid or missing repositoryOwner parameter',
    status: 'error',
    statusCode: 400,
  })
})

test('validates missing clonedRepoUri parameter', async () => {
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoUri: '',
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid or missing clonedRepoUri parameter',
    status: 'error',
    statusCode: 400,
  })
})

test('validates invalid asName parameter', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    asName: '',
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid asName parameter (must be a non-empty string if provided)',
    status: 'error',
    statusCode: 400,
  })
})

test('handles missing package.json', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
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

test('handles dependency not found in package.json', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/other-package': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('packages/e2e/package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
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

test('handles dependency already at target version', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/test-with-playwright': '^2.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('packages/e2e/package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
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

test('uses asName when provided', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/source-control-worker': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/source-control-worker': {
          version: '2.0.0',
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
      [new URL('packages/renderer-worker/package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
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

  const result = await updateSpecificDependency({
    asName: 'source-control-worker',
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'source-control-view',
    fs: mockFs,
    repositoryName: 'lvce-editor',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/renderer-worker',
    toRepo: 'lvce-editor',
  })

  expect(result).toEqual({
    branchName: expect.any(String),
    changedFiles: [
      {
        content: expect.stringContaining('"@lvce-editor/source-control-worker": "^2.0.0"'),
        path: 'packages/renderer-worker/package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'packages/renderer-worker/package-lock.json',
      },
    ],
    commitMessage: expect.any(String),
    pullRequestTitle: expect.any(String),
    status: 'success',
    statusCode: 200,
  })
})

test('handles devDependencies', async () => {
  const oldPackageJson = {
    devDependencies: {
      '@lvce-editor/test-with-playwright': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/test-with-playwright': {
          version: '2.0.0',
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
      [new URL('packages/e2e/package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
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

  const result = await updateSpecificDependency({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fromRepo: 'test-with-playwright',
    fs: mockFs,
    repositoryName: 'test-worker',
    repositoryOwner: 'lvce-editor',
    tagName: 'v2.0.0',
    toFolder: 'packages/e2e',
    toRepo: 'test-worker',
  })

  expect(result).toEqual({
    branchName: expect.any(String),
    changedFiles: [
      {
        content: expect.stringContaining('"@lvce-editor/test-with-playwright": "^2.0.0"'),
        path: 'packages/e2e/package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'packages/e2e/package-lock.json',
      },
    ],
    commitMessage: expect.any(String),
    pullRequestTitle: expect.any(String),
    status: 'success',
    statusCode: 200,
  })
})
