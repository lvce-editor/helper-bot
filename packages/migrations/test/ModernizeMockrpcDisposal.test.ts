import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { createMockNpmFetch } from '../src/parts/CreateMockNpmFetch/CreateMockNpmFetch.ts'
import { modernizeMockrpcDisposal } from '../src/parts/ModernizeMockrpcDisposal/ModernizeMockrpcDisposal.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

test('modernizes mockrpc-disposal successfully', async () => {
  const oldPackageJson = {
    dependencies: {
      '@lvce-editor/rpc': '^4.20.0',
      '@lvce-editor/rpc-registry': '^6.1.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const oldTestContent = `
import { RendererWorker } from '../src/RendererWorker'

test('some test', () => {
  const rpc = RendererWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })

  // test logic here
})
`

  const clonedRepoUri = pathToUri('/test/repo')
  const repoUriWithSlash = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'
  const mockPackageLockJson = JSON.stringify(
    {
      dependencies: {
        '@lvce-editor/rpc': {
          version: '5.0.0',
        },
        '@lvce-editor/rpc-registry': {
          version: '7.0.0',
        },
      },
      lockfileVersion: 3,
      name: 'test-package',
      version: '1.0.0',
    },
    null,
    2,
  )

  const mockFs = createMockFs({
    files: {
      // Create directory entries - include the root directory
      [clonedRepoUri]: '[DIRECTORY]',
      [new URL('package.json', repoUriWithSlash).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('packages/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/app/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/app/package.json', repoUriWithSlash).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('packages/app/test/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/app/test/some.test.ts', repoUriWithSlash).toString()]: oldTestContent,
      [new URL('packages/exec-worker/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/exec-worker/test/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/exec-worker/test/another.test.ts', repoUriWithSlash).toString()]: oldTestContent,
      [new URL('packages/github-worker/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/github-worker/test/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/github-worker/test/third.test.ts', repoUriWithSlash).toString()]: oldTestContent,
    },
  })

  const mockExec = createMockExec(async (file, args, options) => {
    if (file === 'npm' && args?.[0] === 'install') {
      // Write package-lock.json when npm install is called
      const cwd = options?.cwd
      if (cwd) {
        // cwd is a file system path, convert it to URI format using pathToUri for cross-platform support
        const cwdUri = pathToUri(cwd)
        const packageLockPath = new URL('package-lock.json', cwdUri.endsWith('/') ? cwdUri : cwdUri + '/').toString()
        await mockFs.writeFile(packageLockPath, mockPackageLockJson)
      }
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const mockFetch = createMockNpmFetch({
    '@lvce-editor/rpc': '5.0.0',
    '@lvce-editor/rpc-registry': '7.0.0',
  })

  const result = await modernizeMockrpcDisposal({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toMatchObject({
    changedFiles: expect.arrayContaining([
      expect.objectContaining({ path: 'package.json' }),
      expect.objectContaining({ path: 'packages/app/package.json' }),
      expect.objectContaining({ path: 'package-lock.json' }),
      expect.objectContaining({ path: 'packages/app/package-lock.json' }),
      expect.objectContaining({ path: 'packages/app/test/some.test.ts' }),
      expect.objectContaining({ path: 'packages/exec-worker/test/another.test.ts' }),
      expect.objectContaining({ path: 'packages/github-worker/test/third.test.ts' }),
    ]),
    commitMessage: 'Modernize mockrpc-disposal: update dependencies and replace const with using for mockRpc',
    pullRequestTitle: 'feature: modernize mockrpc disposal',
    status: 'success',
    statusCode: 201,
  })

  expect(result.changedFiles).toHaveLength(7)

  // Check package.json files were updated
  const rootPackageJsonChange = result.changedFiles.find((f) => f.path === 'package.json')
  const updatedPackageJson = JSON.parse(rootPackageJsonChange.content)
  expect(updatedPackageJson.dependencies['@lvce-editor/rpc']).toBe('^5.0.0')
  expect(updatedPackageJson.dependencies['@lvce-editor/rpc-registry']).toBe('^7.0.0')

  // Check test files were updated
  const testFileChange = result.changedFiles.find((f) => f.path === 'packages/app/test/some.test.ts')
  expect(testFileChange.content).toContain('using rpc = RendererWorker.registerMockRpc')
  expect(testFileChange.content).not.toContain('const rpc = RendererWorker.registerMockRpc')
})

test('handles missing files gracefully', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {},
  })

  const mockExec = createMockExec(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const mockFetch = createMockNpmFetch({
    '@lvce-editor/rpc': '5.0.0',
    '@lvce-editor/rpc-registry': '7.0.0',
  })

  const result = await modernizeMockrpcDisposal({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('skips files without mockrpc patterns', async () => {
  const packageJsonWithoutRpc = {
    dependencies: {
      'some-other-package': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const testContentWithoutMockRpc = `
import { someOtherFunction } from '../src/utils'

test('some test', () => {
  const result = someOtherFunction()
  expect(result).toBe('expected')
})
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJsonWithoutRpc, null, 2) + '\n',
      [new URL('packages/app/test/some.test.ts', clonedRepoUri).toString()]: testContentWithoutMockRpc,
    },
  })

  const mockExec = createMockExec(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const mockFetch = createMockNpmFetch({
    '@lvce-editor/rpc': '5.0.0',
    '@lvce-editor/rpc-registry': '7.0.0',
  })

  const result = await modernizeMockrpcDisposal({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('handles npm fetch failures gracefully', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]:
        JSON.stringify(
          {
            dependencies: {
              '@lvce-editor/rpc': '^4.20.0',
              '@lvce-editor/rpc-registry': '^6.1.0',
            },
            name: 'test-package',
            version: '1.0.0',
          },
          null,
          2,
        ) + '\n',
    },
  })

  const mockExec = createMockExec(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const mockFetch = createMockNpmFetch(
    {
      '@lvce-editor/rpc': '5.0.0',
      '@lvce-editor/rpc-registry': '7.0.0',
    },
    {
      errorStatus: 500,
      errorStatusText: 'Internal Server Error',
    },
  )

  const result = await modernizeMockrpcDisposal({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toMatchObject({
    changedFiles: [],
    errorCode: 'UPDATE_DEPENDENCIES_FAILED',
    status: 'error',
    statusCode: 424,
  })
})

test('handles network errors during npm fetch', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]:
        JSON.stringify(
          {
            dependencies: {
              '@lvce-editor/rpc': '^4.20.0',
              '@lvce-editor/rpc-registry': '^6.1.0',
            },
            name: 'test-package',
            version: '1.0.0',
          },
          null,
          2,
        ) + '\n',
    },
  })

  const mockExec = createMockExec(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const mockFetch = createMockNpmFetch(
    {
      '@lvce-editor/rpc': '5.0.0',
      '@lvce-editor/rpc-registry': '7.0.0',
    },
    {
      throwError: 'Network timeout',
    },
  )

  const result = await modernizeMockrpcDisposal({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result).toMatchObject({
    changedFiles: [],
    errorCode: 'UPDATE_DEPENDENCIES_FAILED',
    status: 'error',
    statusCode: 424,
  })
})
