import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { modernizeStaticBuild } from '../src/parts/ModernizeStaticBuild/ModernizeStaticBuild.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('updates exportStatic call when old pattern is found', async () => {
  const content = `import { exportStatic } from '@lvce-editor/shared-process'

await exportStatic()
`

  const clonedRepoUri = pathToUri('/test/repo')
  const baseUri = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/build-static.js', baseUri).toString()]: content,
    },
  })

  const result = await modernizeStaticBuild({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-static-build',
    changedFiles: [
      {
        content: `import { exportStatic } from '@lvce-editor/shared-process'
import { join } from 'node:path'

await exportStatic({root: join(import.meta.dirname, '..')})
`,
        path: 'scripts/build-static.js',
      },
    ],
    commitMessage: 'ci: modernize exportStatic call to pass root argument',
    pullRequestTitle: 'ci: modernize exportStatic call to pass root argument',
    status: 'success',
    statusCode: 201,
  })
})

test('updates exportStatic call when join import already exists', async () => {
  const content = `import { exportStatic } from '@lvce-editor/shared-process'
import { join } from 'node:path'

await exportStatic()
`

  const clonedRepoUri = pathToUri('/test/repo')
  const baseUri = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/build-static.js', baseUri).toString()]: content,
    },
  })

  const result = await modernizeStaticBuild({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-static-build',
    changedFiles: [
      {
        content: `import { exportStatic } from '@lvce-editor/shared-process'
import { join } from 'node:path'

await exportStatic({root: join(import.meta.dirname, '..')})
`,
        path: 'scripts/build-static.js',
      },
    ],
    commitMessage: 'ci: modernize exportStatic call to pass root argument',
    pullRequestTitle: 'ci: modernize exportStatic call to pass root argument',
    status: 'success',
    statusCode: 201,
  })
})

test('skips when exportStatic already has root argument', async () => {
  const content = `import { exportStatic } from '@lvce-editor/shared-process'
import { join } from 'node:path'

await exportStatic({root: join(import.meta.dirname, '..')})
`

  const clonedRepoUri = pathToUri('/test/repo')
  const baseUri = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/build-static.js', baseUri).toString()]: content,
    },
  })

  const result = await modernizeStaticBuild({
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
})

test('skips when exportStatic import is not found', async () => {
  const content = `import { something } from '@lvce-editor/shared-process'

await something()
`

  const clonedRepoUri = pathToUri('/test/repo')
  const baseUri = clonedRepoUri.endsWith('/') ? clonedRepoUri : clonedRepoUri + '/'
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/build-static.js', baseUri).toString()]: content,
    },
  })

  const result = await modernizeStaticBuild({
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
})

test('skips when await exportStatic() call is not found', async () => {
  const content = `import { exportStatic } from '@lvce-editor/shared-process'

exportStatic()
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/build-static.js', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeStaticBuild({
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
})

test('handles missing build-static.js file', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await modernizeStaticBuild({
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
})
