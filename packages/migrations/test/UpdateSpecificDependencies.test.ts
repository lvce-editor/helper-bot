import { expect, jest, test } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateSpecificDependencies } from '../src/parts/UpdateSpecificDependencies/UpdateSpecificDependencies.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

test('updates multiple dependencies in one package folder', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('packages/renderer-worker/package.json', clonedRepoUri)]:
        JSON.stringify(
          {
            dependencies: {
              '@lvce-editor/activity-bar-worker': '^1.0.0',
              '@lvce-editor/status-bar-worker': '^2.0.0',
            },
            name: '@lvce-editor/renderer-worker',
            version: '1.0.0',
          },
          null,
          2,
        ) + '\n',
    },
  })
  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (file, args, options) => {
    expect(file).toBe('npm')
    expect(args).toEqual(['install', '--ignore-scripts', '--prefer-online'])
    expect(options?.cwd).toBe(resolveUri('packages/renderer-worker', clonedRepoUri))
    await mockFs.writeFile(
      resolveUri('packages/renderer-worker/package-lock.json', clonedRepoUri),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          'node_modules/@lvce-editor/activity-bar-worker': {
            version: '1.1.0',
          },
          'node_modules/@lvce-editor/status-bar-worker': {
            version: '2.1.0',
          },
        },
      }),
    )
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const result = await updateSpecificDependencies({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'lvce-editor',
    repositoryOwner: 'lvce-editor',
    toRepo: 'lvce-editor',
    updates: [
      {
        fromRepo: 'activity-bar-worker',
        tagName: 'v1.1.0',
        toFolder: 'packages/renderer-worker',
      },
      {
        fromRepo: 'status-bar-worker',
        tagName: 'v2.1.0',
        toFolder: 'packages/renderer-worker',
      },
    ],
  })

  expect(result).toEqual({
    branchName: 'feature/update-dependencies',
    changedFiles: [
      {
        content: expect.stringContaining('"@lvce-editor/activity-bar-worker": "^1.1.0"'),
        path: 'packages/renderer-worker/package.json',
      },
      {
        content: expect.stringContaining('@lvce-editor/status-bar-worker'),
        path: 'packages/renderer-worker/package-lock.json',
      },
    ],
    commitMessage: 'feature: update dependencies',
    pullRequestTitle: 'feature: update dependencies',
    status: 'success',
    statusCode: 201,
  })
  expect(result.status === 'success' && result.changedFiles[0].content).toContain('"@lvce-editor/status-bar-worker": "^2.1.0"')
  expect(mockExecFn).toHaveBeenCalledTimes(1)
})

test('updates multiple package folders', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [resolveUri('packages/renderer-worker/package.json', clonedRepoUri)]:
        JSON.stringify({
          dependencies: {
            '@lvce-editor/activity-bar-worker': '^1.0.0',
          },
          name: '@lvce-editor/renderer-worker',
          version: '1.0.0',
        }) + '\n',
      [resolveUri('packages/shared-process/package.json', clonedRepoUri)]:
        JSON.stringify({
          name: '@lvce-editor/shared-process',
          optionalDependencies: {
            '@lvce-editor/process-explorer': '^3.0.0',
          },
          version: '1.0.0',
        }) + '\n',
    },
  })
  const mockExecFn = jest.fn<
    (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  >(async (_file, _args, options) => {
    if (options?.cwd === resolveUri('packages/renderer-worker', clonedRepoUri)) {
      await mockFs.writeFile(resolveUri('packages/renderer-worker/package-lock.json', clonedRepoUri), '{"name":"renderer"}\n')
    }
    if (options?.cwd === resolveUri('packages/shared-process', clonedRepoUri)) {
      await mockFs.writeFile(resolveUri('packages/shared-process/package-lock.json', clonedRepoUri), '{"name":"shared"}\n')
    }
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const result = await updateSpecificDependencies({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'lvce-editor',
    repositoryOwner: 'lvce-editor',
    toRepo: 'lvce-editor',
    updates: [
      {
        fromRepo: 'activity-bar-worker',
        tagName: 'v1.1.0',
        toFolder: 'packages/renderer-worker',
      },
      {
        fromRepo: 'process-explorer',
        tagName: 'v3.1.0',
        toFolder: 'packages/shared-process',
      },
    ],
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles.map((file) => file.path)).toEqual([
    'packages/renderer-worker/package.json',
    'packages/renderer-worker/package-lock.json',
    'packages/shared-process/package.json',
    'packages/shared-process/package-lock.json',
  ])
  expect(mockExecFn).toHaveBeenCalledTimes(2)
})
