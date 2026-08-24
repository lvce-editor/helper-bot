import { afterEach, expect, test } from '@jest/globals'
import nock from 'nock'
import { getReleaseArchiveIntegrity } from '../src/getReleaseArchiveIntegrity.ts'

afterEach(() => {
  nock.cleanAll()
})

test('hashes the only tar.br asset when its name is nonstandard', async () => {
  const archiveMock = nock('https://github.com')
    .get('/lvce-editor/language-basics-cobol/releases/download/v1.8.0/language-basics-c-v1.8.0.tar.br')
    .reply(200, 'hello')

  const integrity = await getReleaseArchiveIntegrity({
    release: {
      assets: [
        {
          browser_download_url: 'https://github.com/lvce-editor/language-basics-cobol/releases/download/v1.8.0/language-basics-c-v1.8.0.tar.br',
          name: 'language-basics-c-v1.8.0.tar.br',
        },
      ],
      tag_name: 'v1.8.0',
    },
    repository: {
      name: 'language-basics-cobol',
    },
  } as any)

  expect(integrity).toEqual({
    assetName: 'language-basics-c-v1.8.0.tar.br',
    sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  })
  expect(archiveMock.pendingMocks()).toEqual([])
})

test('rejects a release without an unambiguous tar.br asset', async () => {
  await expect(
    getReleaseArchiveIntegrity({
      release: {
        assets: [],
        tag_name: 'v1.0.0',
      },
      repository: {
        name: 'example',
      },
    } as any),
  ).rejects.toThrow('Release v1.0.0 of example must have exactly one .tar.br asset')
})
