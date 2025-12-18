import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { getNewPackageFiles } from '../src/parts/GetNewPackageFiles/GetNewPackageFiles.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

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
      // Write a mock package-lock.json after npm install
      const cwd = options?.cwd
      if (cwd) {
        await mockFs.writeFile(new URL('package-lock.json', cwd).toString(), mockPackageLockJson)
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
  "name": "test-package",
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
    ['install', '--ignore-scripts', '--prefer-online', '--cache', expect.stringMatching(/update-dependencies-test-package-shared-2\.0\.0-tmp-cache/)],
    {
      cwd: expect.stringMatching(/update-dependencies-test-package-shared-2\.0\.0-tmp$/),
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
