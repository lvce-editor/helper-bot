import { jest, test, expect } from '@jest/globals'

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
const mockFs: any = {
  access: jest.fn().mockResolvedValue(undefined),
  chmod: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  mkdtemp: jest.fn().mockResolvedValue('/tmp/test-dir'),
  readdir: jest.fn().mockResolvedValue([]),
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

jest.spyOn(globalThis, 'fetch').mockResolvedValue({
  json: async () => [{ version: 'v18.0.0', lts: 'Hydrogen' }],
} as Response)

const { updateNodeVersionMigration, updateDependenciesMigration, ensureLernaExcludedMigration, updateGithubActionsMigration } =
  await import('../src/migrations/index.ts')

test('updateNodeVersionMigration should return success when no changes needed', async () => {
  const mockOctokit: any = {
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

  expect(result).toEqual({
    success: true,
    message: expect.stringContaining('No changes needed'),
  })
})

test('updateDependenciesMigration should return success when no dependencies found', async () => {
  const mockOctokit: any = {
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

  expect(result).toEqual({
    success: true,
    message: expect.stringContaining('No dependencies configured'),
  })
})

test('ensureLernaExcludedMigration should return success when no script found', async () => {
  mockFs.readFile.mockRejectedValueOnce(new Error('Not found'))

  const mockOctokit: any = {
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

  expect(result).toEqual({
    success: true,
    message: expect.stringContaining('No update-dependencies.sh script found'),
  })
})

test('updateGithubActionsMigration should return success when no workflows found', async () => {
  const mockOctokit: any = {
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

  expect(result).toEqual({
    success: true,
    message: expect.stringContaining('No workflows found'),
  })
})
