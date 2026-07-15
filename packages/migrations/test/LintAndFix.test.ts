import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { lintAndFix } from '../src/parts/LintAndFix/LintAndFix.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const getRequestUrl = (input: string | URL | Request): string => {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input.url
}

const createLatestVersionsFetch = (eslintVersion = '9.39.2', eslintConfigVersion = '4.3.0'): typeof globalThis.fetch => {
  return jest.fn(async (url: string | URL | Request) => {
    const versions: Record<string, string> = {
      'https://registry.npmjs.org/@lvce-editor/eslint-config/latest': eslintConfigVersion,
      'https://registry.npmjs.org/eslint/latest': eslintVersion,
    }
    const requestUrl = getRequestUrl(url)
    const version = versions[requestUrl]
    if (!version) {
      throw new Error(`Unexpected fetch URL: ${requestUrl}`)
    }
    return {
      json: async () => ({ version }),
      ok: true,
    } as Response
  })
}

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
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: originalFileContent,
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && cwd === clonedRepoUri) {
      const updatedPackageJson = {
        ...oldPackageJson,
        devDependencies: {
          ...oldPackageJson.devDependencies,
          '@lvce-editor/eslint-config': '^4.0.0',
          eslint: '^9.39.2',
        },
      }
      await mockFs.writeFile(resolveUri('package.json', cwd), JSON.stringify(updatedPackageJson, null, 2) + '\n')
      await mockFs.writeFile(resolveUri('package-lock.json', cwd), mockPackageLockJson)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Simulate ESLint --fix changing the file
      await mockFs.writeFile(resolveUri('src/test.ts', clonedRepoUri), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return Git status output showing modified file
      return { exitCode: 0, stderr: '', stdout: ' M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
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
    branchName: expect.stringMatching(/^feature\/lint-and-fix-\d+$/),
    changedFiles: [
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
  expect(mockExecFn).toHaveBeenCalledTimes(5)
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
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: fileContent,
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && cwd === clonedRepoUri) {
      const updatedPackageJson = {
        ...oldPackageJson,
        devDependencies: {
          ...oldPackageJson.devDependencies,
          '@lvce-editor/eslint-config': '^4.0.0',
          eslint: '^9.39.2',
        },
      }
      await mockFs.writeFile(resolveUri('package.json', cwd), JSON.stringify(updatedPackageJson, null, 2) + '\n')
      await mockFs.writeFile(resolveUri('package-lock.json', cwd), mockPackageLockJson)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // ESLint doesn't change the file
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // No files changed
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
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
    branchName: expect.stringMatching(/^feature\/lint-and-fix-\d+$/),
    changedFiles: [],
    commitMessage: 'chore: lint and fix code',
    pullRequestTitle: 'chore: lint and fix code',
    status: 'success',
    statusCode: 201,
  })
  expect(mockExecFn).toHaveBeenCalledTimes(5)
})

test('skips eslint installation when @lvce-editor/eslint-config is already at latest version', async () => {
  const oldPackageJson: any = {
    devDependencies: {
      '@lvce-editor/eslint-config': '^4.3.0',
      eslint: '^9.39.2',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/eslint-config': {
          version: '4.3.0',
        },
        eslint: {
          version: '9.39.2',
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

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [resolveUri('package-lock.json', clonedRepoUri)]: mockPackageLockJson,
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: originalFileContent,
    },
  })

  const mockFetch = createLatestVersionsFetch()

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && cwd === clonedRepoUri) {
      throw new Error('npm install should not be called when @lvce-editor/eslint-config is already at latest version')
    }
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      throw new Error('npm ci should not be called when skipping migration')
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
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
  // Should not call npm install when versions are already up to date
  expect(mockExecFn).not.toHaveBeenCalled()
  expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/@lvce-editor/eslint-config/latest')
})

test('skips eslint installation when @lvce-editor/eslint-config is already at latest version and package-lock.json does not exist', async () => {
  const oldPackageJson: any = {
    devDependencies: {
      '@lvce-editor/eslint-config': '^4.3.0',
      eslint: '^9.39.2',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const originalFileContent = `const x = "test"\n`

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: originalFileContent,
    },
  })

  const mockFetch = createLatestVersionsFetch()

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && cwd === clonedRepoUri) {
      throw new Error('npm install should not be called when @lvce-editor/eslint-config is already at latest version')
    }
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      throw new Error('npm ci should not be called when skipping migration')
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
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
  // Should not call npm install when versions are already up to date
  expect(mockExecFn).not.toHaveBeenCalled()
  expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/@lvce-editor/eslint-config/latest')
})

test('skips eslint installation when @lvce-editor/eslint-config is already at latest version but no files need fixing', async () => {
  const oldPackageJson: any = {
    devDependencies: {
      '@lvce-editor/eslint-config': '^4.3.0',
      eslint: '^9.39.2',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/eslint-config': {
          version: '4.3.0',
        },
        eslint: {
          version: '9.39.2',
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
      [resolveUri('package-lock.json', clonedRepoUri)]: mockPackageLockJson,
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: fileContent,
    },
  })

  const mockFetch = createLatestVersionsFetch()

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && cwd === clonedRepoUri) {
      throw new Error('npm install should not be called when @lvce-editor/eslint-config is already at latest version')
    }
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      throw new Error('npm ci should not be called when skipping migration')
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
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
  // Should not call npm install when versions are already up to date
  expect(mockExecFn).not.toHaveBeenCalled()
  expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/@lvce-editor/eslint-config/latest')
})

test('runs eslint fix when force option is set even if eslint config is already at latest version', async () => {
  const oldPackageJson: any = {
    devDependencies: {
      '@lvce-editor/eslint-config': '^4.3.0',
      eslint: '^9.39.2',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/eslint-config': {
          version: '4.3.0',
        },
        eslint: {
          version: '9.39.2',
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
      [resolveUri('package-lock.json', clonedRepoUri)]: mockPackageLockJson,
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: originalFileContent,
    },
  })

  const mockFetch = createLatestVersionsFetch()

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'run' && args?.[1] === 'postinstall' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Simulate ESLint --fix changing the file
      await mockFs.writeFile(resolveUri('src/test.ts', clonedRepoUri), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return Git status output showing modified file
      return { exitCode: 0, stderr: '', stdout: ' M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    force: true,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: expect.stringMatching(/^feature\/lint-and-fix-\d+$/),
    changedFiles: [
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
  // Should run npm CI and ESLint fix even though config is already at latest version
  expect(mockExecFn).toHaveBeenCalledWith('npm', ['ci', '--ignore-scripts'], expect.objectContaining({ cwd: clonedRepoUri }))
  expect(mockExecFn).toHaveBeenCalledWith('npx', ['eslint', '.', '--fix'], expect.objectContaining({ cwd: clonedRepoUri }))
  expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/@lvce-editor/eslint-config/latest')
})

test('upgrades @lvce-editor/eslint-config to latest version when outdated', async () => {
  const oldPackageJson: any = {
    devDependencies: {
      '@lvce-editor/eslint-config': '^4.0.0',
      eslint: '^9.39.2',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/eslint-config': {
          version: '4.0.0',
        },
        eslint: {
          version: '9.39.2',
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
      [resolveUri('package-lock.json', clonedRepoUri)]: mockPackageLockJson,
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: originalFileContent,
    },
  })

  const mockFetch = createLatestVersionsFetch()

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && args?.[2] === '@lvce-editor/eslint-config@4.3.0' && cwd === clonedRepoUri) {
      // Simulate upgrading @lvce-editor/eslint-config
      const updatedPackageJson = {
        ...oldPackageJson,
        devDependencies: {
          ...oldPackageJson.devDependencies,
          '@lvce-editor/eslint-config': '^4.3.0',
        },
      }
      await mockFs.writeFile(resolveUri('package.json', cwd), JSON.stringify(updatedPackageJson, null, 2) + '\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Simulate ESLint --fix changing the file
      await mockFs.writeFile(resolveUri('src/test.ts', clonedRepoUri), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return Git status output showing modified files
      return { exitCode: 0, stderr: '', stdout: ' M package.json\n M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: expect.stringMatching(/^feature\/lint-and-fix-\d+$/),
    changedFiles: expect.arrayContaining([
      {
        content: fixedFileContent,
        path: 'src/test.ts',
      },
    ]),
    commitMessage: 'chore: lint and fix code',
    pullRequestTitle: 'chore: lint and fix code',
    status: 'success',
    statusCode: 201,
  })
  // Should upgrade @lvce-editor/eslint-config to latest version
  expect(mockExecFn).toHaveBeenCalledWith('npm', ['install', '--save-dev', '@lvce-editor/eslint-config@4.3.0'], expect.objectContaining({ cwd: clonedRepoUri }))
  expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/@lvce-editor/eslint-config/latest')
})

test('upgrades eslint when eslint config is already current', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const oldPackageJson = {
    devDependencies: {
      '@lvce-editor/eslint-config': '^4.3.0',
      eslint: '^9.38.0',
    },
    name: 'test-package',
  }
  const fs = createMockFs({
    files: {
      [resolveUri('package-lock.json', clonedRepoUri)]: '{}\n',
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })
  const execFn = jest.fn(async (file: string, args?: readonly string[], _options?: { cwd?: string }) => {
    if (file === 'npm' && args?.[0] === 'ci') {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'install') {
      await fs.writeFile(
        resolveUri('package.json', clonedRepoUri),
        JSON.stringify({ ...oldPackageJson, devDependencies: { ...oldPackageJson.devDependencies, eslint: '^9.39.2' } }, null, 2) + '\n',
      )
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx') {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git') {
      return { exitCode: 0, stderr: '', stdout: ' M package.json\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })

  const result = await lintAndFix({
    clonedRepoUri,
    exec: createMockExec(execFn),
    fetch: createLatestVersionsFetch(),
    fs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(execFn).toHaveBeenCalledWith('npm', ['install', '--save-dev', 'eslint@9.39.2'], { cwd: clonedRepoUri })
  expect(result).toMatchObject({ status: 'success', statusCode: 201 })
})

test('installs @lvce-editor/eslint-config at latest version when not installed', async () => {
  const oldPackageJson: any = {
    devDependencies: {
      eslint: '^9.39.2',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        eslint: {
          version: '9.39.2',
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
      [resolveUri('package-lock.json', clonedRepoUri)]: mockPackageLockJson,
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [resolveUri('src/test.ts', clonedRepoUri)]: originalFileContent,
    },
  })

  const mockFetch = createLatestVersionsFetch()

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && args?.[2] === '@lvce-editor/eslint-config@4.3.0' && cwd === clonedRepoUri) {
      // Simulate installing @lvce-editor/eslint-config
      const updatedPackageJson = {
        ...oldPackageJson,
        devDependencies: {
          ...oldPackageJson.devDependencies,
          '@lvce-editor/eslint-config': '^4.3.0',
        },
      }
      await mockFs.writeFile(resolveUri('package.json', cwd), JSON.stringify(updatedPackageJson, null, 2) + '\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Simulate ESLint --fix changing the file
      await mockFs.writeFile(resolveUri('src/test.ts', clonedRepoUri), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return Git status output showing modified files
      return { exitCode: 0, stderr: '', stdout: ' M package.json\n M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: expect.stringMatching(/^feature\/lint-and-fix-\d+$/),
    changedFiles: expect.arrayContaining([
      {
        content: fixedFileContent,
        path: 'src/test.ts',
      },
    ]),
    commitMessage: 'chore: lint and fix code',
    pullRequestTitle: 'chore: lint and fix code',
    status: 'success',
    statusCode: 201,
  })
  // Should install @lvce-editor/eslint-config at latest version
  expect(mockExecFn).toHaveBeenCalledWith('npm', ['install', '--save-dev', '@lvce-editor/eslint-config@4.3.0'], expect.objectContaining({ cwd: clonedRepoUri }))
  expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/@lvce-editor/eslint-config/latest')
})
