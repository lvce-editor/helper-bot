import { expect, jest, test } from '@jest/globals'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateEslintDependencies } from '../src/parts/UpdateEslintDependencies/UpdateEslintDependencies.ts'
import { pathToUri, resolveUri } from '../src/parts/UriUtils/UriUtils.ts'

const clonedRepoUri = pathToUri('/test/repo') + '/'

test('updates eslint and eslint config together and returns only package files', async () => {
  const oldPackageJson = {
    devDependencies: {
      '@lvce-editor/eslint-config': '^16.3.0',
      eslint: '^10.6.0',
    },
    name: 'example',
  }
  const newPackageJson = {
    ...oldPackageJson,
    devDependencies: {
      '@lvce-editor/eslint-config': '^16.4.0',
      eslint: '^10.7.0',
    },
  }
  const newPackageJsonContent = JSON.stringify(newPackageJson, null, 2) + '\n'
  const newPackageLockJsonContent = JSON.stringify({ lockfileVersion: 3, packages: { '': newPackageJson } }, null, 2) + '\n'
  const fs = createMockFs({
    files: {
      [resolveUri('package-lock.json', clonedRepoUri)]: '{}\n',
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify(oldPackageJson, null, 2) + '\n',
    },
  })
  const exec = jest.fn(async (_file: string, _args?: readonly string[], _options?: { cwd?: string }) => {
    await fs.writeFile(resolveUri('package.json', clonedRepoUri), newPackageJsonContent)
    await fs.writeFile(resolveUri('package-lock.json', clonedRepoUri), newPackageLockJsonContent)
    return { exitCode: 0, stderr: '', stdout: '' }
  })

  const result = await updateEslintDependencies({
    clonedRepoUri,
    eslintConfigVersion: '16.4.0',
    eslintVersion: '10.7.0',
    exec,
    fetch: globalThis.fetch,
    fs,
    repositoryName: 'example',
    repositoryOwner: 'lvce-editor',
  })

  expect(exec).toHaveBeenCalledWith(
    'npm',
    ['install', '--save-dev', 'eslint@10.7.0', '@lvce-editor/eslint-config@16.4.0', '--ignore-scripts', '--prefer-online'],
    { cwd: clonedRepoUri },
  )
  expect(result).toEqual({
    branchName: 'feature/update-eslint-10.7.0-eslint-config-16.4.0',
    changedFiles: [
      { content: newPackageJsonContent, path: 'package.json' },
      { content: newPackageLockJsonContent, path: 'package-lock.json' },
    ],
    commitMessage: 'chore: update eslint and eslint config to latest',
    pullRequestTitle: 'chore: update eslint and eslint config to latest',
    status: 'success',
    statusCode: 201,
  })
})

test('does not run npm when both dependencies are current', async () => {
  const fs = createMockFs({
    files: {
      [resolveUri('package.json', clonedRepoUri)]: JSON.stringify({
        devDependencies: {
          '@lvce-editor/eslint-config': '^16.4.0',
          eslint: '^10.7.0',
        },
      }),
    },
  })
  const exec = jest.fn() as any

  const result = await updateEslintDependencies({
    clonedRepoUri,
    eslintConfigVersion: '16.4.0',
    eslintVersion: '10.7.0',
    exec,
    fetch: globalThis.fetch,
    fs,
    repositoryName: 'example',
    repositoryOwner: 'lvce-editor',
  })

  expect(exec).not.toHaveBeenCalled()
  expect(result).toMatchObject({ changedFiles: [], status: 'success', statusCode: 200 })
})
