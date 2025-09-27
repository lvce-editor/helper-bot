import { jest, test, expect } from '@jest/globals'
import {
  updateNodeVersionMigration,
  updateDependenciesMigration,
  ensureLernaExcludedMigration,
  updateGithubActionsMigration,
} from '../src/migrations/index.js'

// Mock execa to prevent actual git operations
jest.unstable_mockModule('execa', () => ({
  execa: jest.fn().mockImplementation((command: any, args: any) => {
    if (command === 'git' && args[0] === 'clone') {
      return Promise.resolve({ stdout: '', stderr: '' })
    }
    if (command === 'git' && args[0] === 'status') {
      return Promise.resolve({ stdout: '', stderr: '' })
    }
    if (command === 'git' && args[0] === 'checkout') {
      return Promise.resolve({ stdout: '', stderr: '' })
    }
    if (command === 'git' && args[0] === 'add') {
      return Promise.resolve({ stdout: '', stderr: '' })
    }
    if (command === 'git' && args[0] === 'commit') {
      return Promise.resolve({ stdout: '', stderr: '' })
    }
    if (command === 'git' && args[0] === 'push') {
      return Promise.resolve({ stdout: '', stderr: '' })
    }
    return Promise.resolve({ stdout: '', stderr: '' })
  }),
}))

// Mock fs operations
const mockFs = {
  mkdtemp: jest.fn().mockResolvedValue('/tmp/test-dir'),
  rm: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('v18.0.0'),
  writeFile: jest.fn().mockResolvedValue(undefined),
}

jest.unstable_mockModule('node:fs/promises', () => mockFs)

// Mock os
jest.unstable_mockModule('node:os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp'),
}))

// Mock path
jest.unstable_mockModule('node:path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
}))

test('updateNodeVersionMigration should return success when no changes needed', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        getContent: jest.fn().mockResolvedValue({
          data: { content: 'v18.0.0' },
        }),
      },
    },
  }

  const result = await updateNodeVersionMigration.run({
    octokit: mockOctokit as any,
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result.success).toBe(true)
  expect(result.message).toContain('No changes needed')
})

test('updateDependenciesMigration should return success when no dependencies found', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        listReleases: jest.fn().mockResolvedValue({
          data: [{ tag_name: 'v1.0.0' }],
        }),
      },
    },
  }

  const result = await updateDependenciesMigration.run({
    octokit: mockOctokit as any,
    owner: 'test-owner',
    repo: 'unknown-repo',
  })

  expect(result.success).toBe(true)
  expect(result.message).toContain('No dependencies configured')
})

test('ensureLernaExcludedMigration should return success when no script found', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        getContent: jest.fn().mockRejectedValue(new Error('Not found')),
      },
    },
  }

  const result = await ensureLernaExcludedMigration.run({
    octokit: mockOctokit as any,
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result.success).toBe(true)
  expect(result.message).toContain('No update-dependencies.sh script found')
})

test('updateGithubActionsMigration should return success when no workflows found', async () => {
  const mockOctokit = {
    rest: {
      repos: {
        getContent: jest.fn().mockRejectedValue(new Error('Not found')),
      },
    },
  }

  const result = await updateGithubActionsMigration.run({
    octokit: mockOctokit as any,
    owner: 'test-owner',
    repo: 'test-repo',
  })

  expect(result.success).toBe(true)
  expect(result.message).toContain('No workflows found')
})
