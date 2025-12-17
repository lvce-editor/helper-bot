import { test, expect, jest } from '@jest/globals'
import { join } from 'node:path'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateSpecificDependency } from '../src/parts/UpdateSpecificDependency/UpdateSpecificDependency.ts'

test.skip('updates dependency successfully', async () => {
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

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'packages/e2e/package.json')]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(join(cwd, 'package-lock.json'), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].path).toBe('packages/e2e/package.json')
  expect(result.changedFiles[0].content).toContain('"@lvce-editor/test-with-playwright": "^2.0.0"')
  expect(result.changedFiles[1].path).toBe('packages/e2e/package-lock.json')
})

test.skip('validates missing fromRepo parameter', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('error')
  expect(result.errorMessage).toBe('Invalid or missing fromRepo parameter')
  expect(result.changedFiles).toEqual([])
})

test.skip('validates missing toRepo parameter', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('error')
  expect(result.errorMessage).toBe('Invalid or missing toRepo parameter')
  expect(result.changedFiles).toEqual([])
})

test.skip('validates missing toFolder parameter', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('error')
  expect(result.errorMessage).toBe('Invalid or missing toFolder parameter')
  expect(result.changedFiles).toEqual([])
})

test.skip('validates missing tagName parameter', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('error')
  expect(result.errorMessage).toBe('Invalid or missing tagName parameter')
  expect(result.changedFiles).toEqual([])
})

test.skip('validates missing repositoryOwner parameter', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('error')
  expect(result.errorMessage).toBe('Invalid or missing repositoryOwner parameter')
  expect(result.changedFiles).toEqual([])
})

test.skip('validates missing clonedRepoPath parameter', async () => {
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    clonedRepoPath: '',
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

  expect(result.status).toBe('error')
  expect(result.errorMessage).toBe('Invalid or missing clonedRepoPath parameter')
  expect(result.changedFiles).toEqual([])
})

test.skip('validates invalid asName parameter', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExec = createMockExec()

  const result = await updateSpecificDependency({
    asName: '',
    clonedRepoPath,
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

  expect(result.status).toBe('error')
  expect(result.errorMessage).toBe('Invalid asName parameter (must be a non-empty string if provided)')
  expect(result.changedFiles).toEqual([])
})

test.skip('handles missing package.json', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(mockExecFn).not.toHaveBeenCalled()
})

test.skip('handles dependency not found in package.json', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/other-package': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'packages/e2e/package.json')]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(mockExecFn).not.toHaveBeenCalled()
})

test.skip('handles dependency already at target version', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/test-with-playwright': '^2.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'packages/e2e/package.json')]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(mockExecFn).not.toHaveBeenCalled()
})

test.skip('uses asName when provided', async () => {
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

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'packages/renderer-worker/package.json')]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(join(cwd, 'package-lock.json'), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    asName: 'source-control-worker',
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].path).toBe('packages/renderer-worker/package.json')
  expect(result.changedFiles[0].content).toContain('"@lvce-editor/source-control-worker": "^2.0.0"')
  expect(result.changedFiles[1].path).toBe('packages/renderer-worker/package-lock.json')
})

test.skip('handles devDependencies', async () => {
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

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'packages/e2e/package.json')]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(join(cwd, 'package-lock.json'), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateSpecificDependency({
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].path).toBe('packages/e2e/package.json')
  expect(result.changedFiles[0].content).toContain('"@lvce-editor/test-with-playwright": "^2.0.0"')
  expect(result.changedFiles[0].content).toContain('devDependencies')
})
