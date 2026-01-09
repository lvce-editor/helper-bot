import { test, expect } from '@jest/globals'
import { addRepositoryLink } from '../src/parts/AddRepositoryLink/AddRepositoryLink.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('adds repository link to root extension.json when missing', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
    version: '1.0.0',
    displayName: 'My Extension',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.branchName).toBe('feature/add-repository-link')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('extension.json')
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
  expect(updatedContent.name).toBe('my-extension')
  expect(updatedContent.version).toBe('1.0.0')
  expect(updatedContent.displayName).toBe('My Extension')
})

test('adds repository link to monorepo extension.json when missing', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
    version: '1.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('packages/extension/extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.branchName).toBe('feature/add-repository-link')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('packages/extension/extension.json')
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
  expect(updatedContent.name).toBe('my-extension')
})

test('adds repository link to both root and monorepo extension.json when both exist and missing repository', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const rootExtensionJson = {
    name: 'root-extension',
    version: '1.0.0',
  }
  const monorepoExtensionJson = {
    name: 'monorepo-extension',
    version: '2.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(rootExtensionJson, null, 2) + '\n',
      [new URL('packages/extension/extension.json', clonedRepoUri).toString()]: JSON.stringify(monorepoExtensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.changedFiles).toHaveLength(2)

  const rootFile = result.changedFiles.find((f) => f.path === 'extension.json')
  expect(rootFile).toBeDefined()
  const rootContent = JSON.parse(rootFile!.content)
  expect(rootContent.repository).toBe('https://github.com/test/my-repo')
  expect(rootContent.name).toBe('root-extension')

  const monorepoFile = result.changedFiles.find((f) => f.path === 'packages/extension/extension.json')
  expect(monorepoFile).toBeDefined()
  const monorepoContent = JSON.parse(monorepoFile!.content)
  expect(monorepoContent.repository).toBe('https://github.com/test/my-repo')
  expect(monorepoContent.name).toBe('monorepo-extension')
})

test('skips root extension.json when repository already exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
    version: '1.0.0',
    repository: 'https://github.com/other/repo',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(200)
  expect(result.changedFiles).toHaveLength(0)
})

test('skips monorepo extension.json when repository already exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
    version: '1.0.0',
    repository: 'https://github.com/other/repo',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('packages/extension/extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(200)
  expect(result.changedFiles).toHaveLength(0)
})

test('adds repository to root when monorepo already has it', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const rootExtensionJson = {
    name: 'root-extension',
    version: '1.0.0',
  }
  const monorepoExtensionJson = {
    name: 'monorepo-extension',
    version: '2.0.0',
    repository: 'https://github.com/other/repo',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(rootExtensionJson, null, 2) + '\n',
      [new URL('packages/extension/extension.json', clonedRepoUri).toString()]: JSON.stringify(monorepoExtensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('extension.json')
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('adds repository to monorepo when root already has it', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const rootExtensionJson = {
    name: 'root-extension',
    version: '1.0.0',
    repository: 'https://github.com/other/repo',
  }
  const monorepoExtensionJson = {
    name: 'monorepo-extension',
    version: '2.0.0',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(rootExtensionJson, null, 2) + '\n',
      [new URL('packages/extension/extension.json', clonedRepoUri).toString()]: JSON.stringify(monorepoExtensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('packages/extension/extension.json')
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('returns empty result when neither extension.json exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(200)
  expect(result.changedFiles).toHaveLength(0)
})

test('returns empty result when both files exist and already have repository', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const rootExtensionJson = {
    name: 'root-extension',
    repository: 'https://github.com/other/repo',
  }
  const monorepoExtensionJson = {
    name: 'monorepo-extension',
    repository: 'https://github.com/other/repo',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(rootExtensionJson, null, 2) + '\n',
      [new URL('packages/extension/extension.json', clonedRepoUri).toString()]: JSON.stringify(monorepoExtensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(200)
  expect(result.changedFiles).toHaveLength(0)
})

test('preserves all existing properties when adding repository', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
    version: '1.0.0',
    displayName: 'My Extension',
    description: 'A test extension',
    publisher: 'test-publisher',
    categories: ['other'],
    activationEvents: ['onStartupFinished'],
    main: './out/extension.js',
    contributes: {
      commands: [
        {
          command: 'test.command',
          title: 'Test Command',
        },
      ],
    },
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
  expect(updatedContent.name).toBe('my-extension')
  expect(updatedContent.version).toBe('1.0.0')
  expect(updatedContent.displayName).toBe('My Extension')
  expect(updatedContent.description).toBe('A test extension')
  expect(updatedContent.publisher).toBe('test-publisher')
  expect(updatedContent.categories).toEqual(['other'])
  expect(updatedContent.activationEvents).toEqual(['onStartupFinished'])
  expect(updatedContent.main).toBe('./out/extension.js')
  expect(updatedContent.contributes).toEqual({
    commands: [
      {
        command: 'test.command',
        title: 'Test Command',
      },
    ],
  })
})

test('handles extension.json with empty object', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {}
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('handles extension.json with null repository property', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const extensionJson = {
    name: 'my-extension',
    repository: null,
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('handles extension.json with empty string repository property', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const extensionJson = {
    name: 'my-extension',
    repository: '',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('handles invalid JSON gracefully', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: 'invalid json{',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('error')
  expect(result.statusCode).toBeGreaterThanOrEqual(400)
  expect(result.errorCode).toBe('ADD_REPOSITORY_LINK_FAILED')
  expect(result.errorMessage).toBeDefined()
})

test('handles repository owner and name with special characters', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const extensionJson = {
    name: 'my-extension',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo-123',
    repositoryOwner: 'test-org',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(updatedContent.repository).toBe('https://github.com/test-org/my-repo-123')
})

test('handles clonedRepoUri without trailing slash', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const extensionJson = {
    name: 'my-extension',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri + '/').toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri: clonedRepoUri.replace(/\/$/, ''),
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.changedFiles).toHaveLength(1)
})

test('handles clonedRepoUri with trailing slash', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const extensionJson = {
    name: 'my-extension',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri + '/').toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri: clonedRepoUri + '/',
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result.status).toBe('success')
  expect(result.statusCode).toBe(201)
  expect(result.changedFiles).toHaveLength(1)
})
