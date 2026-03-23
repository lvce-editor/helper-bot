import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { downgradeEslintIfNeeded } from '../src/parts/DowngradeEslintIfNeeded/DowngradeEslintIfNeeded.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('restores previous eslint version when update sets eslint 10', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const packageJsonUri = new URL('package.json', clonedRepoUri).toString()
  const packageJson = {
    devDependencies: {
      eslint: '^10.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockFs = createMockFs({
    files: {
      [packageJsonUri]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn(async () => {
    throw new Error('npm install should not be called when previous eslint version is known')
  })

  const result = await downgradeEslintIfNeeded(mockFs, createMockExec(mockExecFn), packageJsonUri, '/test/repo', {
    devDependencies: '^9.39.1',
  })

  const updatedPackageJson = JSON.parse(await mockFs.readFile(packageJsonUri, 'utf8'))

  expect(result).toBe(true)
  expect(updatedPackageJson.devDependencies.eslint).toBe('^9.39.1')
  expect(mockExecFn).not.toHaveBeenCalled()
})

test('falls back to npm downgrade when eslint 10 is present and previous version is unknown', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const packageJsonUri = new URL('package.json', clonedRepoUri).toString()
  const packageJson = {
    devDependencies: {
      eslint: '^10.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockFs = createMockFs({
    files: {
      [packageJsonUri]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn(async (file: string, args?: readonly string[], options?: { cwd?: string }) => {
    expect(file).toBe('npm')
    expect(args).toEqual(['install', '--save-dev', 'eslint@^9', '--ignore-scripts', '--prefer-online'])
    expect(options?.cwd).toBe('/test/repo')
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const result = await downgradeEslintIfNeeded(mockFs, createMockExec(mockExecFn), packageJsonUri, '/test/repo')

  expect(result).toBe(true)
  expect(mockExecFn).toHaveBeenCalledTimes(1)
})

test('returns false when eslint 10 is not present', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const packageJsonUri = new URL('package.json', clonedRepoUri).toString()
  const packageJson = {
    devDependencies: {
      eslint: '^9.39.1',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockFs = createMockFs({
    files: {
      [packageJsonUri]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn(async () => {
    throw new Error('npm install should not be called when eslint 10 is absent')
  })

  const result = await downgradeEslintIfNeeded(mockFs, createMockExec(mockExecFn), packageJsonUri, '/test/repo')

  expect(result).toBe(false)
  expect(mockExecFn).not.toHaveBeenCalled()
})
