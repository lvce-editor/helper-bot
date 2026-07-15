import { expect, jest, test } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateStartupBenchmarkVersions } from '../src/parts/UpdateStartupBenchmarkVersions/UpdateStartupBenchmarkVersions.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const clonedRepoUri = pathToUri('/test/repo')
const versionsUri = resolveUri('versions.json', `${clonedRepoUri}/`)

test('updates versions.json with the latest 150 server versions', async () => {
  const oldContent = '{\n  "versions": ["1.0.0"]\n}\n'
  const newContent = '{\n  "versions": ["1.0.1", "1.0.0"]\n}\n'
  const fs = createMockFs({
    files: {
      [versionsUri]: oldContent,
    },
  })
  const execMock = jest.fn<
    (file: string, args?: readonly string[], options?: Readonly<{ cwd?: string }>) => Promise<{ exitCode: number; stderr: string; stdout: string }>
  >(async () => {
    await fs.writeFile(versionsUri, newContent)
    return { exitCode: 0, stderr: '', stdout: 'Updated versions.json with 150 versions' }
  })
  const exec = createMockExec(execMock)

  const result = await updateStartupBenchmarkVersions({
    clonedRepoUri,
    exec,
    fetch: globalThis.fetch,
    fs,
    repositoryName: 'lvce-startup-benchmark',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    branchName: 'feature/update-startup-benchmark-versions',
    changedFiles: [
      {
        content: newContent,
        path: 'versions.json',
      },
    ],
    commitMessage: 'feature: update startup benchmark versions',
    pullRequestTitle: 'feature: update startup benchmark versions',
    status: 'success',
    statusCode: 201,
  })
  expect(execMock).toHaveBeenCalledWith('npm', ['run', 'update-versions', '--', '--count', '150'], { cwd: clonedRepoUri })
})

test('returns an empty result when versions.json is already current', async () => {
  const content = '{\n  "versions": ["1.0.0"]\n}\n'
  const fs = createMockFs({
    files: {
      [versionsUri]: content,
    },
  })

  const result = await updateStartupBenchmarkVersions({
    clonedRepoUri,
    exec: createMockExec(),
    fetch: globalThis.fetch,
    fs,
    repositoryName: 'lvce-startup-benchmark',
    repositoryOwner: 'lvce-editor',
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

test('rejects other repositories', async () => {
  const result = await updateStartupBenchmarkVersions({
    clonedRepoUri,
    exec: createMockExec(),
    fetch: globalThis.fetch,
    fs: createMockFs(),
    repositoryName: 'other-repository',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'This migration can only be run on repository "lvce-startup-benchmark", but got "other-repository"',
    status: 'error',
    statusCode: 400,
  })
})

test('returns an error when updating versions fails', async () => {
  const fs = createMockFs({
    files: {
      [versionsUri]: '{\n  "versions": ["1.0.0"]\n}\n',
    },
  })

  const result = await updateStartupBenchmarkVersions({
    clonedRepoUri,
    exec: createMockExec(async () => {
      throw new Error('npm registry unavailable')
    }),
    fetch: globalThis.fetch,
    fs,
    repositoryName: 'lvce-startup-benchmark',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'UPDATE_STARTUP_BENCHMARK_VERSIONS_FAILED',
    errorMessage: 'npm registry unavailable',
    status: 'error',
    statusCode: 424,
  })
})
