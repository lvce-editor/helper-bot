import { test, expect, jest } from '@jest/globals'
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
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', repoUriWithSlash).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('packages/app/package.json', repoUriWithSlash).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('packages/app/test/some.test.ts', repoUriWithSlash).toString()]: oldTestContent,
      [new URL('packages/exec-worker/test/another.test.ts', repoUriWithSlash).toString()]: oldTestContent,
      [new URL('packages/github-worker/test/third.test.ts', repoUriWithSlash).toString()]: oldTestContent,
      // Create directory entries - include the root directory
      [clonedRepoUri]: '[DIRECTORY]',
      [new URL('packages/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/app/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/app/test/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/exec-worker/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/exec-worker/test/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/github-worker/', repoUriWithSlash).toString()]: '[DIRECTORY]',
      [new URL('packages/github-worker/test/', repoUriWithSlash).toString()]: '[DIRECTORY]',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const mockExec = createMockExec(mockExecFn)

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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(5) // 2 package.json files + 3 test files
  if (result.status === 'success') {
    expect(result.pullRequestTitle).toBe('Modernize mockrpc-disposal')
    expect(result.commitMessage).toBe('Modernize mockrpc-disposal: update dependencies and replace const with using for mockRpc')
    expect(result.branchName).toBe('modernize-mockrpc-disposal')
  }

  // Check package.json files were updated
  const updatedPackageJson = JSON.parse(await mockFs.readFile(new URL('package.json', clonedRepoUri).toString(), 'utf8'))
  expect(updatedPackageJson.dependencies['@lvce-editor/rpc']).toBe('^5.0.0')
  expect(updatedPackageJson.dependencies['@lvce-editor/rpc-registry']).toBe('^7.0.0')

  // Check test files were updated
  const updatedTestContent = await mockFs.readFile(new URL('packages/app/test/some.test.ts', clonedRepoUri).toString(), 'utf8')
  expect(updatedTestContent).toContain('using rpc = RendererWorker.registerMockRpc')
  expect(updatedTestContent).not.toContain('const rpc = RendererWorker.registerMockRpc')
})

test('handles missing files gracefully', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {},
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const mockExec = createMockExec(mockExecFn)

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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(0)
  if (result.status === 'success') {
    expect(result.pullRequestTitle).toBe('')
    expect(result.commitMessage).toBe('')
    expect(result.branchName).toBe('')
  }
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

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const mockExec = createMockExec(mockExecFn)

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

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(0)
  if (result.status === 'success') {
    expect(result.pullRequestTitle).toBe('')
    expect(result.commitMessage).toBe('')
    expect(result.branchName).toBe('')
  }
})

test('handles npm fetch failures gracefully', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify({
        dependencies: {
          '@lvce-editor/rpc': '^4.20.0',
          '@lvce-editor/rpc-registry': '^6.1.0',
        },
        name: 'test-package',
        version: '1.0.0',
      }, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const mockExec = createMockExec(mockExecFn)

  // Mock fetch that returns error responses for npm registry calls
  const mockFetch = jest.fn<typeof globalThis.fetch>(async (url: string | URL | Request) => {
    const urlStr = url.toString()
    if (urlStr.includes('registry.npmjs.org')) {
      return new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      })
    }
    throw new Error(`Unexpected fetch call: ${urlStr}`)
  })

  const result = await modernizeMockrpcDisposal({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.status).toBe('error')
  if (result.status === 'error') {
    expect(result.errorCode).toBe('UPDATE_DEPENDENCIES_FAILED')
    expect(result.errorMessage).toContain('Failed to fetch latest version')
  }
})

test('handles network errors during npm fetch', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify({
        dependencies: {
          '@lvce-editor/rpc': '^4.20.0',
          '@lvce-editor/rpc-registry': '^6.1.0',
        },
        name: 'test-package',
        version: '1.0.0',
      }, null, 2) + '\n',
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const mockExec = createMockExec(mockExecFn)

  // Mock fetch that throws network error
  const mockFetch = jest.fn<typeof globalThis.fetch>(async (url: string | URL | Request) => {
    const urlStr = url.toString()
    if (urlStr.includes('registry.npmjs.org')) {
      throw new Error('Network timeout')
    }
    throw new Error(`Unexpected fetch call: ${urlStr}`)
  })

  const result = await modernizeMockrpcDisposal({
    clonedRepoUri,
    exec: mockExec,
    fetch: mockFetch,
    fs: mockFs,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.status).toBe('error')
  if (result.status === 'error') {
    expect(result.errorCode).toBe('UPDATE_DEPENDENCIES_FAILED')
    expect(result.errorMessage).toContain('Network timeout')
  }
})
