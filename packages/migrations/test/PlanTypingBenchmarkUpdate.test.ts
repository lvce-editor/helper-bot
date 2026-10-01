import { expect, jest, test } from '@jest/globals'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { planTypingBenchmarkUpdate } from '../src/parts/PlanTypingBenchmarkUpdate/PlanTypingBenchmarkUpdate.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const createLatestVersionsFetch = (versions: Readonly<Record<string, string>>): typeof globalThis.fetch => {
  return jest.fn(async (url: string | URL | Request) => {
    const requestUrl = url instanceof Request ? url.url : String(url)
    const version = versions[requestUrl] || ''
    return {
      json: async () => ({ version }),
      ok: version !== '',
      statusText: 'Not Found',
    } as Response
  })
}

test('plans only published LVCE runtime updates that differ from exact pins', async () => {
  const clonedRepoUri = pathToUri('/test/typing-benchmark')
  const fs = createMockFs({
    files: {
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify({
        dependencies: {
          '@lvce-editor/editor-worker': '19.60.2',
          '@lvce-editor/server': '0.114.2',
          '@lvce-editor/static-server': '0.114.2',
        },
      }),
    },
  })
  const fetch = createLatestVersionsFetch({
    'https://registry.npmjs.org/@lvce-editor/editor-worker/latest': '19.60.3',
    'https://registry.npmjs.org/@lvce-editor/static-server/latest': '0.114.2',
  })

  const result = await planTypingBenchmarkUpdate({
    clonedRepoUri,
    exec: jest.fn() as any,
    fetch,
    fs,
    repositoryName: 'lvce-typing-benchmark',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toMatchObject({
    data: {
      updates: [
        {
          fromRepo: 'editor-worker',
          tagName: 'v19.60.3',
          toFolder: '.',
        },
      ],
    },
    status: 'success',
  })
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('returns no updates when the target repository already has the latest runtime pins', async () => {
  const clonedRepoUri = pathToUri('/test/typing-benchmark')
  const fs = createMockFs({
    files: {
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify({
        dependencies: {
          '@lvce-editor/editor-worker': '19.60.3',
          '@lvce-editor/static-server': '0.114.2',
        },
      }),
    },
  })
  const fetch = createLatestVersionsFetch({
    'https://registry.npmjs.org/@lvce-editor/editor-worker/latest': '19.60.3',
    'https://registry.npmjs.org/@lvce-editor/static-server/latest': '0.114.2',
  })

  const result = await planTypingBenchmarkUpdate({
    clonedRepoUri,
    exec: jest.fn() as any,
    fetch,
    fs,
    repositoryName: 'lvce-typing-benchmark',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toMatchObject({ data: { updates: [] }, status: 'success' })
})

test('rejects another target repository', async () => {
  const result = await planTypingBenchmarkUpdate({
    clonedRepoUri: pathToUri('/test/other'),
    exec: jest.fn() as any,
    fetch: createLatestVersionsFetch({}),
    fs: createMockFs(),
    repositoryName: 'helper-bot',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toMatchObject({ errorCode: 'VALIDATION_ERROR', status: 'error' })
})
