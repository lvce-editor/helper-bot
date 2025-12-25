import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { lintAndFix } from '../src/parts/LintAndFix/LintAndFix.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('installs eslint and runs eslint --fix', async () => {
  const oldPackageJson: any = {
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

  const originalFileContent = `const x = "test"\n`
  const fixedFileContent = `const x = 'test'\n`

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: originalFileContent,
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev') {
      if (cwd) {
        const updatedPackageJson = {
          ...oldPackageJson,
          devDependencies: {
            ...oldPackageJson.devDependencies,
            '@lvce-editor/eslint-config': '^4.0.0',
            eslint: '^9.39.2',
          },
        }
        await mockFs.writeFile(new URL('package.json', cwd).toString(), JSON.stringify(updatedPackageJson, null, 2) + '\n')
        await mockFs.writeFile(new URL('package-lock.json', cwd).toString(), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--ignore-scripts') {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'ci') {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint') {
      // Simulate eslint --fix changing the file
      await mockFs.writeFile(new URL('src/test.ts', clonedRepoUri).toString(), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain') {
      // Return git status output showing modified file
      return { exitCode: 0, stderr: '', stdout: ' M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/lint-and-fix',
    changedFiles: [
      {
        content: expect.stringMatching(/"eslint": "\^\d+\.\d+\.\d+"/),
        path: 'package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'package-lock.json',
      },
      {
        content: fixedFileContent,
        path: 'src/test.ts',
      },
    ],
    commitMessage: 'chore: lint and fix code',
    pullRequestTitle: 'chore: lint and fix code',
    status: 'success',
    statusCode: 201,
  })

  expect(result.changedFiles[0].content).toMatch(/"@lvce-editor\/eslint-config": "\^\d+\.\d+\.\d+"/)
  expect(mockExecFn).toHaveBeenCalledTimes(4)
})

test('handles missing package.json', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
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

test('handles case when no files need fixing', async () => {
  const oldPackageJson: any = {
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

  const fileContent = `const x = 'test'\n`

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: fileContent,
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev') {
      if (cwd) {
        const updatedPackageJson = {
          ...oldPackageJson,
          devDependencies: {
            ...oldPackageJson.devDependencies,
            '@lvce-editor/eslint-config': '^4.0.0',
            eslint: '^9.39.2',
          },
        }
        await mockFs.writeFile(new URL('package.json', cwd).toString(), JSON.stringify(updatedPackageJson, null, 2) + '\n')
        await mockFs.writeFile(new URL('package-lock.json', cwd).toString(), mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--ignore-scripts') {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'ci') {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint') {
      // Eslint doesn't change the file
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain') {
      // No files changed
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/lint-and-fix',
    changedFiles: [
      {
        content: expect.stringMatching(/"eslint": "\^\d+\.\d+\.\d+"/),
        path: 'package.json',
      },
      {
        content: mockPackageLockJson,
        path: 'package-lock.json',
      },
    ],
    commitMessage: 'chore: lint and fix code',
    pullRequestTitle: 'chore: lint and fix code',
    status: 'success',
    statusCode: 201,
  })

  expect(result.changedFiles[0].content).toMatch(/"@lvce-editor\/eslint-config": "\^\d+\.\d+\.\d+"/)
  expect(mockExecFn).toHaveBeenCalledTimes(4)
})
