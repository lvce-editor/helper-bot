import { test, expect, jest } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { modernizeTsconfig } from '../src/parts/ModernizeTsconfig/ModernizeTsconfig.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

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
  const targetPath = new URL('packages/e2e/tsconfig.json', clonedRepoUri).toString()
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: '{"scripts":{"format":"prettier --write ."}}',
      [targetPath]: content,
    },
  })
  const mockExecFn = jest.fn(async (file: string, args?: readonly string[], options?: { cwd?: string }) => {
    if (file === 'npm' && args?.join(' ') === 'ci --ignore-scripts' && options?.cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    if (file === 'npm' && args?.join(' ') === 'run format' && options?.cwd === clonedRepoUri) {
      await mockFs.writeFile(
        targetPath,
        `{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodeNext",
    "target": "es2022"
  }
}
`,
      )
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })

  const result = await modernizeTsconfig({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
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
    "module": "nodenext",
    "moduleResolution": "nodeNext",
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

  expect(mockExecFn).toHaveBeenCalledTimes(2)
  expect(mockExecFn).toHaveBeenNthCalledWith(1, 'npm', ['ci', '--ignore-scripts'], { cwd: clonedRepoUri })
  expect(mockExecFn).toHaveBeenNthCalledWith(2, 'npm', ['run', 'format'], { cwd: clonedRepoUri })
})

test('creates compilerOptions when missing', async () => {
  const content = `{
  "extends": "../../tsconfig.json"
}
`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: '{"scripts":{"test":"npm test"}}',
      [new URL('packages/e2e/tsconfig.json', clonedRepoUri).toString()]: content,
    },
  })
  const mockExecFn = jest.fn(async (file: string, args?: readonly string[], options?: { cwd?: string }) => {
    if (file === 'npm' && args?.join(' ') === 'ci --ignore-scripts' && options?.cwd === clonedRepoUri) {
      return { exitCode: 0, stderr: '', stdout: '' }
    }
    throw new Error(`Unexpected exec call: ${file} ${args?.join(' ')}`)
  })

  const result = await modernizeTsconfig({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
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

  expect(mockExecFn).toHaveBeenCalledTimes(1)
  expect(mockExecFn).toHaveBeenCalledWith('npm', ['ci', '--ignore-scripts'], { cwd: clonedRepoUri })
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
  const mockExecFn = jest.fn(async () => {
    throw new Error('exec should not be called')
  })

  const result = await modernizeTsconfig({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
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

  expect(mockExecFn).not.toHaveBeenCalled()
})

test('handles missing tsconfig file', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()
  const mockExecFn = jest.fn(async () => {
    throw new Error('exec should not be called')
  })

  const result = await modernizeTsconfig({
    clonedRepoUri,
    exec: createMockExec(mockExecFn),
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

  expect(mockExecFn).not.toHaveBeenCalled()
})
