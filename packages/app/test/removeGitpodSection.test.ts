import { jest, test, expect, beforeEach } from '@jest/globals'
import nock from 'nock'

const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}

const mockExeca = jest.fn()
const mockOs = {
  tmpdir: jest.fn(),
}

jest.unstable_mockModule('node:fs/promises', () => mockFs)
jest.unstable_mockModule('execa', () => ({ execa: mockExeca }))
jest.unstable_mockModule('node:os', () => mockOs)

const { removeGitpodSectionMigration } = await import('../src/migrations/removeGitpodSection.ts')

beforeEach(() => {
  jest.clearAllMocks()
})

test('removeGitpodSectionMigration should remove Gitpod sections from README', async () => {
  if (process.platform === 'win32') {
    return
  }

  // Setup mocks
  mockOs.tmpdir.mockReturnValue('/tmp')
  mockFs.mkdtemp.mockResolvedValue('/tmp/remove-gitpod-section-123')
  mockFs.rm.mockResolvedValue(undefined)

  mockFs.readFile.mockImplementation((path) => {
    if (path.includes('/tmp/remove-gitpod-section-123/README.md')) {
      return `# My Project

This is a great project.

## Gitpod

[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/owner/repo)

This project is ready to be developed in Gitpod.

## Installation

Follow these steps to install the project.

## Usage

Here's how to use the project.`
    }
    throw new Error('File not found')
  })

  mockExeca
    .mockResolvedValueOnce({ stdout: '' }) // git clone
    .mockResolvedValueOnce({ stdout: ' M README.md' }) // git status
    .mockResolvedValueOnce({ stdout: '' }) // git checkout
    .mockResolvedValueOnce({ stdout: '' }) // git add
    .mockResolvedValueOnce({ stdout: '' }) // git commit
    .mockResolvedValueOnce({ stdout: '' }) // git push

  const mockOctokit = {
    rest: {
      git: {
        getRef: jest.fn().mockResolvedValue({
          data: { object: { sha: 'base-sha' } },
        }),
        getCommit: jest.fn().mockResolvedValue({
          data: { tree: { sha: 'tree-sha' }, sha: 'commit-sha' },
        }),
        createTree: jest.fn().mockResolvedValue({
          data: { sha: 'new-tree-sha' },
        }),
        createCommit: jest.fn().mockResolvedValue({
          data: { sha: 'new-commit-sha' },
        }),
        createRef: jest.fn().mockResolvedValue({
          data: { ref: 'refs/heads/new-branch' },
        }),
        updateRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        create: jest.fn().mockResolvedValue({
          data: {
            number: 123,
            html_url: 'https://github.com/owner/repo/pull/123',
          },
        }),
      },
    },
  }

  const result = await removeGitpodSectionMigration.run({
    octokit: mockOctokit as any,
    owner: 'owner',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    changedFiles: 1,
    newBranch: expect.stringMatching(/^remove-gitpod-section-\d+$/),
    message: 'Gitpod sections removed from README files',
  })
  expect(mockFs.writeFile).toHaveBeenCalledWith(expect.stringContaining('README.md'), expect.not.stringContaining('## Gitpod'))
})

test('removeGitpodSectionMigration should handle README without Gitpod section', async () => {
  if (process.platform === 'win32') {
    return
  }

  // Setup mocks
  mockOs.tmpdir.mockReturnValue('/tmp')
  mockFs.mkdtemp.mockResolvedValue('/tmp/remove-gitpod-section-123')
  mockFs.rm.mockResolvedValue(undefined)

  mockFs.readFile.mockImplementation((path) => {
    if (path.includes('/tmp/remove-gitpod-section-123/README.md')) {
      return `# My Project

This is a great project.

## Installation

Follow these steps to install the project.

## Usage

Here's how to use the project.`
    }
    throw new Error('File not found')
  })

  mockExeca
    .mockResolvedValueOnce({ stdout: '' }) // git clone
    .mockResolvedValueOnce({ stdout: '' }) // git status

  const result = await removeGitpodSectionMigration.run({
    octokit: {} as any,
    owner: 'owner',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    message: 'No Gitpod sections found in README files',
  })
})

test('removeGitpodSectionMigration should handle multiple README files', async () => {
  if (process.platform === 'win32') {
    return
  }

  // Setup mocks
  mockOs.tmpdir.mockReturnValue('/tmp')
  mockFs.mkdtemp.mockResolvedValue('/tmp/remove-gitpod-section-123')
  mockFs.rm.mockResolvedValue(undefined)

  mockFs.readFile.mockImplementation((path) => {
    console.log('readFile called with:', path)
    if (path.includes('/tmp/remove-gitpod-section-123/README.md')) {
      return `# My Project

## Gitpod

This project is ready to be developed in Gitpod.

## Installation

Follow these steps.`
    }
    if (path.includes('/tmp/remove-gitpod-section-123/readme.md')) {
      return `# Another Project

## Gitpod

Another Gitpod section.

## Usage

Here's how to use it.`
    }
    throw new Error('File not found')
  })

  mockExeca.mockImplementation((command, args) => {
    console.log('execa called with:', command, args)
    if (command === 'git' && args[0] === 'clone') {
      return Promise.resolve({ stdout: '' })
    }
    if (command === 'git' && args[0] === 'status') {
      return Promise.resolve({ stdout: ' M README.md\n M readme.md' })
    }
    if (command === 'git' && args[0] === 'checkout') {
      return Promise.resolve({ stdout: '' })
    }
    if (command === 'git' && args[0] === 'add') {
      return Promise.resolve({ stdout: '' })
    }
    if (command === 'git' && args[0] === 'commit') {
      return Promise.resolve({ stdout: '' })
    }
    if (command === 'git' && args[0] === 'push') {
      return Promise.resolve({ stdout: '' })
    }
    return Promise.resolve({ stdout: '' })
  })

  const mockOctokit = {
    rest: {
      git: {
        getRef: jest.fn().mockResolvedValue({
          data: { object: { sha: 'base-sha' } },
        }),
        getCommit: jest.fn().mockResolvedValue({
          data: { tree: { sha: 'tree-sha' }, sha: 'commit-sha' },
        }),
        createTree: jest.fn().mockResolvedValue({
          data: { sha: 'new-tree-sha' },
        }),
        createCommit: jest.fn().mockResolvedValue({
          data: { sha: 'new-commit-sha' },
        }),
        createRef: jest.fn().mockResolvedValue({
          data: { ref: 'refs/heads/new-branch' },
        }),
        updateRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        create: jest.fn().mockResolvedValue({
          data: {
            number: 123,
            html_url: 'https://github.com/owner/repo/pull/123',
          },
        }),
      },
    },
  }

  const result = await removeGitpodSectionMigration.run({
    octokit: mockOctokit as any,
    owner: 'owner',
    repo: 'repo',
  })

  expect(result).toEqual({
    success: true,
    changedFiles: 2,
    newBranch: expect.stringMatching(/^remove-gitpod-section-\d+$/),
    message: 'Gitpod sections removed from README files',
  })
  expect(mockFs.writeFile).toHaveBeenCalledTimes(2)
})
