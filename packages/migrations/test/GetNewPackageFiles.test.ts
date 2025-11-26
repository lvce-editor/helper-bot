import { test, expect } from '@jest/globals'
import { join } from 'node:path'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { getNewPackageFiles } from '../src/parts/GetNewPackageFiles/GetNewPackageFiles.ts'

test('generates new package files with updated dependency', async () => {
  const oldPackageJson = {
    name: 'test-package',
    version: '1.0.0',
    dependencies: {
      '@lvce-editor/shared': '^1.0.0',
    },
  }

  const mockPackageLockJson = JSON.stringify(
    {
      name: 'test-package',
      version: '1.0.0',
      lockfileVersion: 3,
      dependencies: {
        '@lvce-editor/shared': {
          version: '2.0.0',
        },
      },
    },
    null,
    2,
  )

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'package.json')]:
        JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })

  const mockExec = createMockExec(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      // Write a mock package-lock.json after npm install
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(
          join(cwd, 'package-lock.json'),
          mockPackageLockJson,
        )
      }
      return { stdout: '', stderr: '', exitCode: 0 }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })

  const result = await getNewPackageFiles({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    dependencyName: 'shared',
    dependencyKey: 'dependencies',
    newVersion: '2.0.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
    fs: mockFs,
    clonedRepoPath,
    fetch: globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].path).toBe('package.json')
  expect(result.changedFiles[0].content).toContain(
    '"@lvce-editor/shared": "^2.0.0"',
  )
  expect(result.changedFiles[1].path).toBe('package-lock.json')
  expect(result.changedFiles[1].content).toBe(mockPackageLockJson)
  expect(result.pullRequestTitle).toBe(
    'feature: update shared to version 2.0.0',
  )
})

test('handles missing package.json', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()
  const mockExec = createMockExec(async () => {
    throw new Error('Should not be called')
  })

  const result = await getNewPackageFiles({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    dependencyName: 'test-dependency',
    dependencyKey: 'dependencies',
    newVersion: '2.0.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
    fs: mockFs,
    clonedRepoPath,
    fetch: globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
