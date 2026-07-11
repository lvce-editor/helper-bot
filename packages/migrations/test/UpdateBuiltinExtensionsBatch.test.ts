import { expect, test } from '@jest/globals'
import type { UpdateBuiltinExtensionsBatchOptions } from '../src/parts/UpdateBuiltinExtensionsBatch/UpdateBuiltinExtensionsBatch.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateBuiltinExtensionsBatch } from '../src/parts/UpdateBuiltinExtensionsBatch/UpdateBuiltinExtensionsBatch.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const builtinExtensionsPath = 'packages/build/src/parts/DownloadBuiltinExtensions/builtinExtensions.json'

const createOptions = (content: string): UpdateBuiltinExtensionsBatchOptions => {
  const clonedRepoUri = pathToUri('/test/repo')
  return {
    clonedRepoUri,
    exec: createMockExec(async () => ({ exitCode: 0, stderr: '', stdout: '' })),
    fetch: globalThis.fetch,
    fs: createMockFs({
      files: {
        [resolveUri(builtinExtensionsPath, clonedRepoUri)]: content,
      },
    }),
    repositoryName: 'lvce-editor',
    repositoryOwner: 'lvce-editor',
    updates: [],
  }
}

test('updates multiple builtin extensions in one migration', async () => {
  const options = createOptions(
    JSON.stringify(
      [
        { name: 'builtin.activity-bar-worker', version: '1.0.0' },
        { name: 'builtin.status-bar-worker', version: '2.0.0' },
        { name: 'builtin.unchanged', version: '3.0.0' },
      ],
      null,
      2,
    ) + '\n',
  )

  const result = await updateBuiltinExtensionsBatch({
    ...options,
    updates: [
      { repositoryName: 'activity-bar-worker', tagName: 'v1.1.0' },
      { repositoryName: 'status-bar-worker', tagName: 'v2.1.0' },
      { repositoryName: 'not-a-builtin-extension', tagName: 'v4.0.0' },
    ],
  })

  expect(result).toEqual({
    branchName: 'feature/update-builtin-extensions',
    changedFiles: [
      {
        content: expect.stringContaining('"version": "1.1.0"'),
        path: builtinExtensionsPath,
      },
    ],
    commitMessage: 'feature: update builtin extensions',
    pullRequestTitle: 'feature: update builtin extensions',
    status: 'success',
    statusCode: 201,
  })
  expect(result.status === 'success' && result.changedFiles[0].content).toContain('"version": "2.1.0"')
  expect(result.status === 'success' && result.changedFiles[0].content).toContain('"version": "3.0.0"')
})

test('returns no changes when none of the released repositories are builtin extensions', async () => {
  const options = createOptions(JSON.stringify([{ name: 'builtin.activity-bar-worker', version: '1.0.0' }], null, 2) + '\n')

  const result = await updateBuiltinExtensionsBatch({
    ...options,
    updates: [{ repositoryName: 'helper-bot', tagName: 'v8.20.0' }],
  })

  expect(result.changedFiles).toEqual([])
  expect(result.statusCode).toBe(200)
})
