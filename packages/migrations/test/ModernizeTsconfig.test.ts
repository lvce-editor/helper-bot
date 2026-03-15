import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { modernizeTsconfig } from '../src/parts/ModernizeTsconfig/ModernizeTsconfig.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('updates moduleResolution and module in e2e tsconfig', async () => {
  const content = `{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "es2022"
  }
}
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('packages/e2e/tsconfig.json', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeTsconfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-tsconfig',
    changedFiles: [
      {
        content: `{
  "compilerOptions": {
    "moduleResolution": "nodeNext",
    "module": "nodenext",
    "target": "es2022"
  }
}
`,
        path: 'packages/e2e/tsconfig.json',
      },
    ],
    commitMessage: 'ci: modernize e2e tsconfig module settings',
    pullRequestTitle: 'ci: modernize e2e tsconfig module settings',
    status: 'success',
    statusCode: 201,
  })
})

test('creates compilerOptions when missing', async () => {
  const content = `{
  "extends": "../../tsconfig.json"
}
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('packages/e2e/tsconfig.json', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeTsconfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-tsconfig',
    changedFiles: [
      {
        content: `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "nodeNext",
    "module": "nodenext"
  }
}
`,
        path: 'packages/e2e/tsconfig.json',
      },
    ],
    commitMessage: 'ci: modernize e2e tsconfig module settings',
    pullRequestTitle: 'ci: modernize e2e tsconfig module settings',
    status: 'success',
    statusCode: 201,
  })
})

test('skips when values are already modernized', async () => {
  const content = `{
  "compilerOptions": {
    "moduleResolution": "nodeNext",
    "module": "nodenext"
  }
}
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('packages/e2e/tsconfig.json', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeTsconfig({
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

test('handles missing tsconfig file', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await modernizeTsconfig({
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
