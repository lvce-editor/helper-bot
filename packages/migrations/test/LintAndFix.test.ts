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
    if (file === 'npm' && args?.[0] === 'install' && args?.[1] === '--save-dev' && cwd === clonedRepoUri) {
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
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Simulate eslint --fix changing the file
      await mockFs.writeFile(new URL('src/test.ts', clonedRepoUri).toString(), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return git status output showing modified file
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
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: fileContent,
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
      await mockFs.writeFile(new URL('package.json', cwd).toString(), JSON.stringify(updatedPackageJson, null, 2) + '\n')
      await mockFs.writeFile(new URL('package-lock.json', cwd).toString(), mockPackageLockJson)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'ci' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Eslint doesn't change the file
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
      [new URL('package-lock.json', clonedRepoUri).toString()]: mockPackageLockJson,
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: originalFileContent,
    },
  })

  // Mock fetch to return latest version as 4.3.0 (same as installed)
  const mockFetch = jest.fn(async (url: string) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/eslint-config/latest') {
      return {
        json: async () => ({ version: '4.3.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })

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
    fetch: mockFetch as any,
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
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: originalFileContent,
    },
  })

  // Mock fetch to return latest version as 4.3.0 (same as installed)
  const mockFetch = jest.fn(async (url: string) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/eslint-config/latest') {
      return {
        json: async () => ({ version: '4.3.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })

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
    fetch: mockFetch as any,
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
      [new URL('package-lock.json', clonedRepoUri).toString()]: mockPackageLockJson,
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: fileContent,
    },
  })

  // Mock fetch to return latest version as 4.3.0 (same as installed)
  const mockFetch = jest.fn(async (url: string) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/eslint-config/latest') {
      return {
        json: async () => ({ version: '4.3.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })

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
    fetch: mockFetch as any,
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
      [new URL('package-lock.json', clonedRepoUri).toString()]: mockPackageLockJson,
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: originalFileContent,
    },
  })

  // Mock fetch to return latest version as 4.3.0 (same as installed)
  const mockFetch = jest.fn(async (url: string) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/eslint-config/latest') {
      return {
        json: async () => ({ version: '4.3.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })

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
      // Simulate eslint --fix changing the file
      await mockFs.writeFile(new URL('src/test.ts', clonedRepoUri).toString(), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return git status output showing modified file
      return { exitCode: 0, stderr: '', stdout: ' M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
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
  // Should run npm ci and eslint fix even though config is already at latest version
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
      [new URL('package-lock.json', clonedRepoUri).toString()]: mockPackageLockJson,
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: originalFileContent,
    },
  })

  // Mock fetch to return latest version as 4.3.0 (newer than installed 4.0.0)
  const mockFetch = jest.fn(async (url: string) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/eslint-config/latest') {
      return {
        json: async () => ({ version: '4.3.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })

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
      await mockFs.writeFile(new URL('package.json', cwd).toString(), JSON.stringify(updatedPackageJson, null, 2) + '\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Simulate eslint --fix changing the file
      await mockFs.writeFile(new URL('src/test.ts', clonedRepoUri).toString(), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return git status output showing modified files
      return { exitCode: 0, stderr: '', stdout: ' M package.json\n M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
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
      [new URL('package-lock.json', clonedRepoUri).toString()]: mockPackageLockJson,
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('src/test.ts', clonedRepoUri).toString()]: originalFileContent,
    },
  })

  // Mock fetch to return latest version as 4.3.0
  const mockFetch = jest.fn(async (url: string) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/eslint-config/latest') {
      return {
        json: async () => ({ version: '4.3.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })

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
      await mockFs.writeFile(new URL('package.json', cwd).toString(), JSON.stringify(updatedPackageJson, null, 2) + '\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npx' && args?.[0] === 'eslint' && cwd === clonedRepoUri) {
      // Simulate eslint --fix changing the file
      await mockFs.writeFile(new URL('src/test.ts', clonedRepoUri).toString(), fixedFileContent)
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return git status output showing modified files
      return { exitCode: 0, stderr: '', stdout: ' M package.json\n M src/test.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await lintAndFix({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch as any,
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
