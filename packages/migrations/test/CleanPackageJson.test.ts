import { test, expect } from '@jest/globals'
import { cleanPackageJson } from '../src/parts/CleanPackageJson/CleanPackageJson.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('sets license to MIT when not set', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    status: 'success',
    statusCode: 201,
    changedFiles: [
      {
        path: 'package.json',
        content: expect.stringContaining('"license": "MIT"'),
      },
    ],
  })
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.license).toBe('MIT')
  expect(updatedPackageJson.name).toBe('test-package')
  expect(updatedPackageJson.version).toBe('1.0.0')
})

test('removes empty keywords array', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    keywords: [] as string[],
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    status: 'success',
    statusCode: 201,
    changedFiles: [
      {
        path: 'package.json',
        content: expect.not.stringContaining('"keywords"'),
      },
    ],
  })
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.keywords).toBeUndefined()
})

test('sets author to Lvce Editor when empty string', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    author: '',
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    status: 'success',
    statusCode: 201,
    changedFiles: [
      {
        path: 'package.json',
        content: expect.stringContaining('"author": "Lvce Editor"'),
      },
    ],
  })
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.author).toBe('Lvce Editor')
})

test('sets author to Lvce Editor when missing', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.author).toBe('Lvce Editor')
})

test('applies all three changes together', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    author: '',
    keywords: [] as string[],
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.license).toBe('MIT')
  expect(updatedPackageJson.author).toBe('Lvce Editor')
  expect(updatedPackageJson.keywords).toBeUndefined()
})

test('returns empty result when no changes needed', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    author: 'Lvce Editor',
    license: 'MIT',
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
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

test('handles missing package.json', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
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

test('preserves existing license when already set', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    license: 'Apache-2.0',
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.license).toBe('Apache-2.0')
  expect(updatedPackageJson.author).toBe('Lvce Editor')
})

test('preserves existing author when already set', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    author: 'John Doe',
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.author).toBe('John Doe')
  expect(updatedPackageJson.license).toBe('MIT')
})

test('preserves keywords array with items', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    keywords: ['test', 'example'],
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.keywords).toEqual(['test', 'example'])
})

test('preserves keywords when not an array', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    keywords: 'test',
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.keywords).toBe('test')
})

test('removes empty skip array', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    skip: [] as string[],
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.skip).toBeUndefined()
})

test('preserves skip array with items', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    skip: ['test', 'example'],
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.skip).toEqual(['test', 'example'])
})

test('preserves skip when not an array', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    skip: 'test',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.skip).toBe('test')
})

test('removes empty skip array along with other changes', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    author: '',
    keywords: [] as string[],
    name: 'test-package',
    skip: [] as string[],
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.license).toBe('MIT')
  expect(updatedPackageJson.author).toBe('Lvce Editor')
  expect(updatedPackageJson.keywords).toBeUndefined()
  expect(updatedPackageJson.skip).toBeUndefined()
})

test('preserves author when it is an object', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    author: {
      email: 'john@example.com',
      name: 'John Doe',
    },
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.author).toEqual({
    email: 'john@example.com',
    name: 'John Doe',
  })
})

test('handles invalid JSON gracefully', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: 'invalid json{',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  const errorResult = result as { status: 'error'; errorCode: string; errorMessage: string }
  expect(errorResult.errorCode).toBe('CLEAN_PACKAGE_JSON_FAILED')
  expect(errorResult.errorMessage).toBeDefined()
})

test('only sets license when missing, not when null', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    license: null as string | null,
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.license).toBe('MIT')
})

test('handles complex package.json with all fields', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    dependencies: {
      lodash: '^4.17.21',
    },
    description: 'A test package',
    keywords: [] as string[],
    main: 'index.js',
    name: 'test-package',
    scripts: {
      test: 'jest',
    },
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.license).toBe('MIT')
  expect(updatedPackageJson.author).toBe('Lvce Editor')
  expect(updatedPackageJson.keywords).toBeUndefined()
  expect(updatedPackageJson.name).toBe('test-package')
  expect(updatedPackageJson.version).toBe('1.0.0')
  expect(updatedPackageJson.description).toBe('A test package')
  expect(updatedPackageJson.main).toBe('index.js')
  expect(updatedPackageJson.scripts).toEqual({ test: 'jest' })
  expect(updatedPackageJson.dependencies).toEqual({ lodash: '^4.17.21' })
})

test('returns correct branch name and commit message', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  const successResult = result as { status: 'success'; branchName: string; commitMessage: string; pullRequestTitle: string }
  expect(successResult.branchName).toBe('feature/clean-package-json')
  expect(successResult.commitMessage).toBe('chore: clean package.json')
  expect(successResult.pullRequestTitle).toBe('chore: clean package.json')
})

test('removes empty test-tokenize.skip array', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    'test-tokenize': {
      skip: [] as string[],
    },
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson['test-tokenize']).toBeDefined()
  expect(updatedPackageJson['test-tokenize'].skip).toBeUndefined()
})

test('preserves test-tokenize.skip array with items', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    'test-tokenize': {
      skip: ['test', 'example'],
    },
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson['test-tokenize'].skip).toEqual(['test', 'example'])
})

test('preserves test-tokenize.skip when not an array', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    'test-tokenize': {
      skip: 'test',
    },
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson['test-tokenize'].skip).toBe('test')
})

test('preserves test-tokenize when skip does not exist', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    name: 'test-package',
    'test-tokenize': {
      other: 'value',
    },
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson['test-tokenize']).toEqual({ other: 'value' })
})

test('removes empty test-tokenize.skip array along with other changes', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const packageJson = {
    author: '',
    keywords: [] as string[],
    name: 'test-package',
    'test-tokenize': {
      skip: [] as string[],
    },
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('package.json', clonedRepoUri).toString()]: JSON.stringify(packageJson, null, 2) + '\n',
    },
  })

  const result = await cleanPackageJson({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'test-package',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedPackageJson = JSON.parse(result.changedFiles[0].content)
  expect(updatedPackageJson.license).toBe('MIT')
  expect(updatedPackageJson.author).toBe('Lvce Editor')
  expect(updatedPackageJson.keywords).toBeUndefined()
  expect(updatedPackageJson['test-tokenize']).toBeDefined()
  expect(updatedPackageJson['test-tokenize'].skip).toBeUndefined()
})
