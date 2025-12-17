import { test, expect, jest } from '@jest/globals'
import { join } from 'node:path'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { getNewPackageFiles } from '../src/parts/GetNewPackageFiles/GetNewPackageFiles.ts'

test('generates new package files with updated dependency', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/shared': '^1.0.0',
    },
    name: 'test-package',
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
      name: 'test-package',
      version: '1.0.0',
    },
    null,
    2,
  )

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'package.json')]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      // Write a mock package-lock.json after npm install
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(join(cwd, 'package-lock.json'), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await getNewPackageFiles({
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].path).toBe('package.json')
  expect(result.changedFiles[0].content).toContain('"@lvce-editor/shared": "^2.0.0"')
  expect(result.changedFiles[1].path).toBe('package-lock.json')
  expect(result.changedFiles[1].content).toBe(mockPackageLockJson)
  expect(result.pullRequestTitle).toBe('feature: update shared to version 2.0.0')
  expect(result.branchName).toBe('feature/update-shared-to-2.0.0')
  expect(result.commitMessage).toBe('feature: update shared to version 2.0.0')

  expect(mockExecFn).toHaveBeenCalledTimes(1)
  expect(mockExecFn).toHaveBeenCalledWith(
    'npm',
    ['install', '--ignore-scripts', '--prefer-online', '--cache', expect.stringMatching(/update-dependencies-test-package-shared-2\.0\.0-tmp-cache/)],
    {
      cwd: expect.stringMatching(/update-dependencies-test-package-shared-2\.0\.0-tmp$/),
    },
  )
})

test('handles missing package.json', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await getNewPackageFiles({
    clonedRepoPath,
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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(mockExecFn).not.toHaveBeenCalled()
})
