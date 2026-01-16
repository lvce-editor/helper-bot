import { test, expect } from '@jest/globals'
import { addRepositoryLink } from '../src/parts/AddRepositoryLink/AddRepositoryLink.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('adds repository link to root extension.json when missing', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    displayName: 'My Extension',
    name: 'my-extension',
    version: '1.0.0',
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'packages/extension/extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
  expect(updatedContent.name).toBe('my-extension')
})

test('adds repository link to both root and monorepo extension.json when both exist and missing repository', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
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

  const rootFile = result.changedFiles.find((f) => f.path === 'extension.json')
  const monorepoFile = result.changedFiles.find((f) => f.path === 'packages/extension/extension.json')
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'packages/extension/extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
  const rootContent = JSON.parse(rootFile.content)
  const monorepoContent = JSON.parse(monorepoFile.content)
  expect(rootContent.repository).toBe('https://github.com/test/my-repo')
  expect(rootContent.name).toBe('root-extension')
  expect(monorepoContent.repository).toBe('https://github.com/test/my-repo')
  expect(monorepoContent.name).toBe('monorepo-extension')
})

test('skips root extension.json when repository already exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
    repository: 'https://github.com/other/repo',
    version: '1.0.0',
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

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('skips monorepo extension.json when repository already exists', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
    repository: 'https://github.com/other/repo',
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

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('adds repository to root when monorepo already has it', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const rootExtensionJson = {
    name: 'root-extension',
    version: '1.0.0',
  }
  const monorepoExtensionJson = {
    name: 'monorepo-extension',
    repository: 'https://github.com/other/repo',
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('adds repository to monorepo when root already has it', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const rootExtensionJson = {
    name: 'root-extension',
    repository: 'https://github.com/other/repo',
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'packages/extension/extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
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

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
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

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('preserves all existing properties when adding repository', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    activationEvents: ['onStartupFinished'],
    categories: ['other'],
    contributes: {
      commands: [
        {
          command: 'test.command',
          title: 'Test Command',
        },
      ],
    },
    description: 'A test extension',
    displayName: 'My Extension',
    main: './out/extension.js',
    name: 'my-extension',
    publisher: 'test-publisher',
    version: '1.0.0',
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
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
  const extensionJson: Record<string, unknown> = {}
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('handles extension.json with null repository property', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson: { name: string; repository: null } = {
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('handles extension.json with empty string repository property', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
  expect(updatedContent.repository).toBe('https://github.com/test/my-repo')
})

test('handles invalid JSON gracefully', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
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

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'ADD_REPOSITORY_LINK_FAILED',
    errorMessage: expect.any(String),
    status: 'error',
    statusCode: expect.any(Number),
  })
  expect(result.statusCode).toBeGreaterThanOrEqual(400)
})

test('handles repository owner and name with special characters', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
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

  const updatedContent = JSON.parse(result.changedFiles[0].content)
  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test-org/my-repo-123"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
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
    clonedRepoUri: clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
})

test('handles clonedRepoUri with trailing slash', async () => {
  const clonedRepoUri = pathToUri('/test/repo') + '/'
  const extensionJson = {
    name: 'my-extension',
  }
  const mockFs = createMockFs({
    files: {
      [new URL('extension.json', clonedRepoUri).toString()]: JSON.stringify(extensionJson, null, 2) + '\n',
    },
  })

  const result = await addRepositoryLink({
    clonedRepoUri: clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'my-repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/add-repository-link',
    changedFiles: [
      {
        content: expect.stringContaining('"repository": "https://github.com/test/my-repo"'),
        path: 'extension.json',
      },
    ],
    commitMessage: 'feature: add repository link to extension.json',
    pullRequestTitle: 'feature: add repository link to extension.json',
    status: 'success',
    statusCode: 201,
  })
})
