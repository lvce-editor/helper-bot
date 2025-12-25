import { test, expect, jest } from '@jest/globals'
import type { MigrationErrorResult } from '../src/parts/Types/Types.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateAllDependencies } from '../src/parts/UpdateAllDependencies/UpdateAllDependencies.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('runs npm ci and detects changed files', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package-lock.json', clonedRepoUri).toString()]: '{}',
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
      [new URL('src/index.ts', clonedRepoUri).toString()]: 'export const x = 1\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      // Simulate npm ci modifying package-lock.json
      await mockFs.writeFile(new URL('package-lock.json', clonedRepoUri).toString(), '{"lockfileVersion": 3}\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: ' M package-lock.json\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: expect.stringMatching(/^chore\/update-all-dependencies-\d+$/),
    changedFiles: [
      {
        content: '{"lockfileVersion": 3}\n',
        path: 'package-lock.json',
      },
    ],
    commitMessage: 'chore: update all dependencies',
    pullRequestTitle: 'chore: update all dependencies',
    status: 'success',
    statusCode: 201,
  })
  expect(mockExecFn).toHaveBeenCalledTimes(4)
})

test('returns empty result when no files changed', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
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
  expect(mockExecFn).toHaveBeenCalledTimes(4)
})

test('handles missing package.json', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('Should not be called')
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
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

test('runs postinstall script when it exists', async () => {
  const packageJson = {
    name: 'test-package',
    scripts: {
      postinstall: 'echo "postinstall"',
    },
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'run' && args?.[1] === 'postinstall' && cwd === clonedRepoUri) {
      // Simulate postinstall modifying a file
      await mockFs.writeFile(new URL('postinstall-output.txt', clonedRepoUri).toString(), 'postinstall ran\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '?? postinstall-output.txt\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: expect.stringMatching(/^chore\/update-all-dependencies-\d+$/),
    changedFiles: [
      {
        content: 'postinstall ran\n',
        path: 'postinstall-output.txt',
      },
    ],
    commitMessage: 'chore: update all dependencies',
    pullRequestTitle: 'chore: update all dependencies',
    status: 'success',
    statusCode: 201,
  })
  expect(mockExecFn).toHaveBeenCalledTimes(5)
})

test('runs update-dependencies.sh when it exists', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      // Simulate script modifying a file
      await mockFs.writeFile(new URL('updated.txt', clonedRepoUri).toString(), 'updated\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: ' M updated.txt\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: expect.stringMatching(/^chore\/update-all-dependencies-\d+$/),
    changedFiles: [
      {
        content: 'updated\n',
        path: 'updated.txt',
      },
    ],
    commitMessage: 'chore: update all dependencies',
    pullRequestTitle: 'chore: update all dependencies',
    status: 'success',
    statusCode: 201,
  })
  expect(mockExecFn).toHaveBeenCalledTimes(4)
})

test('runs both postinstall and update-dependencies.sh', async () => {
  const packageJson = {
    name: 'test-package',
    scripts: {
      postinstall: 'echo "postinstall"',
    },
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
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
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      await mockFs.writeFile(new URL('updated.txt', clonedRepoUri).toString(), 'updated\n')
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: ' M updated.txt\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: expect.stringMatching(/^chore\/update-all-dependencies-\d+$/),
    changedFiles: [
      {
        content: 'updated\n',
        path: 'updated.txt',
      },
    ],
    commitMessage: 'chore: update all dependencies',
    pullRequestTitle: 'chore: update all dependencies',
    status: 'success',
    statusCode: 201,
  })
  expect(mockExecFn).toHaveBeenCalledTimes(5)
})

test('handles npm ci failure', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      const error = new Error('npm ci failed')
      // @ts-ignore
      error.exitCode = 1
      throw error
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  const errorResult: MigrationErrorResult = result as MigrationErrorResult
  expect(errorResult.errorCode).toBe('UPDATE_DEPENDENCIES_FAILED')
  expect(errorResult.errorMessage).toContain('Failed to run npm ci --ignore-scripts')
  expect(errorResult.changedFiles).toEqual([])
})

test('handles postinstall script failure', async () => {
  const packageJson = {
    name: 'test-package',
    scripts: {
      postinstall: 'exit 1',
    },
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.[0] === 'run' && args?.[1] === 'postinstall' && cwd === clonedRepoUri) {
      const error = new Error('npm run postinstall failed')
      // @ts-ignore
      error.exitCode = 1
      throw error
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  const errorResult: MigrationErrorResult = result as MigrationErrorResult
  expect(errorResult.errorCode).toBe('UPDATE_DEPENDENCIES_FAILED')
  expect(errorResult.errorMessage).toContain('Failed to run npm run postinstall')
  expect(errorResult.changedFiles).toEqual([])
})

test('handles update-dependencies.sh failure', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\nexit 1\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      const error = new Error('update-dependencies.sh failed')
      // @ts-ignore
      error.exitCode = 1
      throw error
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  const errorResult: MigrationErrorResult = result as MigrationErrorResult
  expect(errorResult.errorCode).toBe('UPDATE_DEPENDENCIES_FAILED')
  expect(errorResult.errorMessage).toContain('Failed to execute scripts/update-dependencies.sh')
  expect(errorResult.changedFiles).toEqual([])
})

test('handles multiple changed files', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('file1.ts', clonedRepoUri).toString()]: 'export const a = 1\n',
      [new URL('file2.ts', clonedRepoUri).toString()]: 'export const b = 2\n',
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: ' M file1.ts\n M file2.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].path).toBe('file1.ts')
  expect(result.changedFiles[1].path).toBe('file2.ts')
})

test('skips deleted files', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('file1.ts', clonedRepoUri).toString()]: 'export const a = 1\n',
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // D = deleted, M = modified
      return { exitCode: 0, stderr: '', stdout: ' D deleted.ts\n M file1.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('file1.ts')
})

test('handles added files', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('new-file.ts', clonedRepoUri).toString()]: 'export const new = true\n',
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // A = added
      return { exitCode: 0, stderr: '', stdout: 'A  new-file.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('new-file.ts')
  expect(result.changedFiles[0].content).toBe('export const new = true\n')
})

test('handles untracked files', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
      [new URL('untracked.ts', clonedRepoUri).toString()]: 'export const untracked = true\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // ?? = untracked
      return { exitCode: 0, stderr: '', stdout: '?? untracked.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('untracked.ts')
  expect(result.changedFiles[0].content).toBe('export const untracked = true\n')
})

test('handles package.json without scripts', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  // Should not call npm run postinstall
  expect(mockExecFn).toHaveBeenCalledTimes(4)
  const { calls } = mockExecFn.mock
  expect(calls.some((call) => call[0] === 'npm' && call[1]?.[0] === 'run' && call[1]?.[1] === 'postinstall')).toBe(false)
})

test('handles package.json with empty scripts object', async () => {
  const packageJson = {
    name: 'test-package',
    scripts: {},
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  // Should not call npm run postinstall
  expect(mockExecFn).toHaveBeenCalledTimes(4)
  const { calls } = mockExecFn.mock
  expect(calls.some((call) => call[0] === 'npm' && call[1]?.[0] === 'run' && call[1]?.[1] === 'postinstall')).toBe(false)
})

test('handles invalid package.json', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: 'invalid json{',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  const errorResult: MigrationErrorResult = result as MigrationErrorResult
  expect(errorResult.errorCode).toBe('UPDATE_DEPENDENCIES_FAILED')
  expect(errorResult.errorMessage).toMatch(/Failed to read package\.json|Unexpected token/)
  expect(mockExecFn).toHaveBeenCalledTimes(1)
})

test('handles git status with empty lines', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('file.ts', clonedRepoUri).toString()]: 'export const x = 1\n',
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Git status with empty lines
      return { exitCode: 0, stderr: '', stdout: ' M file.ts\n\n  \n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('file.ts')
})

test('handles git status with short lines', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Short line (less than 4 characters)
      return { exitCode: 0, stderr: '', stdout: 'X\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles file read error', async () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: '#!/bin/bash\necho "updating dependencies"\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    const cwd = options?.cwd
    if (file === 'npm' && args?.[0] === 'ci' && args?.[1] === '--ignore-scripts' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'chmod' && args?.[0] === '+x' && args?.[1] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'bash' && args?.[0] === 'scripts/update-dependencies.sh' && cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain' && cwd === clonedRepoUri) {
      // Return a file that doesn't exist in mockFs
      return { exitCode: 0, stderr: '', stdout: ' M non-existent.ts\n' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')} with cwd ${cwd}`)
  })
  const mockExec = createMockExec(mockExecFn)

  const result = await updateAllDependencies({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  const errorResult: MigrationErrorResult = result as MigrationErrorResult
  expect(errorResult.errorCode).toBe('UPDATE_DEPENDENCIES_FAILED')
  expect(errorResult.errorMessage).toContain('Failed to read')
})
