import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
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
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('packages/app/package.json', clonedRepoUri).toString()]: JSON.stringify(oldPackageJson, null, 2) + '\n',
      [new URL('packages/app/test/some.test.ts', clonedRepoUri).toString()]: oldTestContent,
    },
  })

  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async () => {
    return { exitCode: 0, stderr: '', stdout: '' }
  })
  const mockExec = createMockExec(mockExecFn)

  const mockFetch = jest.fn<typeof globalThis.fetch>(async (url) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/rpc/latest') {
      return {
        json: async () => ({ version: '5.0.0' }),
        ok: true,
      } as Response
    }
    if (url === 'https://registry.npmjs.org/@lvce-editor/rpc-registry/latest') {
      return {
        json: async () => ({ version: '7.0.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch call: ${url}`)
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
  expect(result.changedFiles).toHaveLength(3)
  if (result.status === 'success') {
    expect(result.pullRequestTitle).toBe('Modernize mockrpc-disposal')
    expect(result.commitMessage).toBe('Modernize mockrpc-disposal: update dependencies and replace const with using for mockRpc')
    expect(result.branchName).toBe('modernize-mockrpc-disposal')
  }

  // Check package.json was updated
  const updatedPackageJson = JSON.parse(await mockFs.readFile(new URL('package.json', clonedRepoUri).toString(), 'utf8'))
  expect(updatedPackageJson.dependencies['@lvce-editor/rpc']).toBe('^5.0.0')
  expect(updatedPackageJson.dependencies['@lvce-editor/rpc-registry']).toBe('^7.0.0')

  // Check test file was updated
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

  const mockFetch = jest.fn<typeof globalThis.fetch>(async (url) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/rpc/latest') {
      return {
        json: async () => ({ version: '5.0.0' }),
        ok: true,
      } as Response
    }
    if (url === 'https://registry.npmjs.org/@lvce-editor/rpc-registry/latest') {
      return {
        json: async () => ({ version: '7.0.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch call: ${url}`)
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

  const mockFetch = jest.fn<typeof globalThis.fetch>(async (url) => {
    if (url === 'https://registry.npmjs.org/@lvce-editor/rpc/latest') {
      return {
        json: async () => ({ version: '5.0.0' }),
        ok: true,
      } as Response
    }
    if (url === 'https://registry.npmjs.org/@lvce-editor/rpc-registry/latest') {
      return {
        json: async () => ({ version: '7.0.0' }),
        ok: true,
      } as Response
    }
    throw new Error(`Unexpected fetch call: ${url}`)
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
