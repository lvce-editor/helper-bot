import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { modernizeSpellcheck } from '../src/parts/ModernizeSpellcheck/ModernizeSpellcheck.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('adds rules object with cspell disabled when eslint config exists without rules', async () => {
  const content = `import * as config from '@lvce-editor/eslint-config'
import * as actions from '@lvce-editor/eslint-plugin-github-actions'

export default [...config.default, ...actions.default]
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('eslint.config.js', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeSpellcheck({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-spellcheck',
    changedFiles: [
      {
        content: `import * as config from '@lvce-editor/eslint-config'
import * as actions from '@lvce-editor/eslint-plugin-github-actions'

export default [...config.default, ...actions.default, { rules: { '@cspell/spellchecker': 'off' } }]
`,
        path: 'eslint.config.js',
      },
    ],
    commitMessage: 'ci: disable cspell/spellchecker in eslint config',
    pullRequestTitle: 'ci: disable cspell/spellchecker in eslint config',
    status: 'success',
    statusCode: 201,
  })
})

test('updates existing rules object to disable cspell', async () => {
  const content = `import * as config from '@lvce-editor/eslint-config'

export default [...config.default, { rules: { 'no-console': 'warn' } }]
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('eslint.config.js', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeSpellcheck({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-spellcheck',
    changedFiles: [
      {
        content: `import * as config from '@lvce-editor/eslint-config'

export default [...config.default, { rules: { 'no-console': 'warn', '@cspell/spellchecker': 'off' } }]
`,
        path: 'eslint.config.js',
      },
    ],
    commitMessage: 'ci: disable cspell/spellchecker in eslint config',
    pullRequestTitle: 'ci: disable cspell/spellchecker in eslint config',
    status: 'success',
    statusCode: 201,
  })
})

test('skips when cspell already disabled', async () => {
  const content = `import * as config from '@lvce-editor/eslint-config'

export default [...config.default, { rules: { '@cspell/spellchecker': 'off' } }]
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('eslint.config.js', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeSpellcheck({
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

test('handles eslint.config.js not existing', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await modernizeSpellcheck({
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

test('preserves existing formatting and whitespace', async () => {
  const content = `import * as config from '@lvce-editor/eslint-config'

export default [
  ...config.default,
  {
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error'
    }
  }
]
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('eslint.config.js', clonedRepoUri).toString()]: content,
    },
  })

  const result = await modernizeSpellcheck({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/modernize-spellcheck',
    changedFiles: [
      {
        content: `import * as config from '@lvce-editor/eslint-config'

export default [
  ...config.default,
  {
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
      '@cspell/spellchecker': 'off'
    }
  }
]
`,
        path: 'eslint.config.js',
      },
    ],
    commitMessage: 'ci: disable cspell/spellchecker in eslint config',
    pullRequestTitle: 'ci: disable cspell/spellchecker in eslint config',
    status: 'success',
    statusCode: 201,
  })
})
