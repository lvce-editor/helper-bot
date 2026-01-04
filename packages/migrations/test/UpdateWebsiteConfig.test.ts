import type { Octokit } from '@octokit/rest'
import { expect, test } from '@jest/globals'
import type { MigrationErrorResult, MigrationSuccessResult } from '../src/parts/Types/Types.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { updateWebsiteConfig } from '../src/parts/UpdateWebsiteConfig/UpdateWebsiteConfig.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()
const clonedRepoUri = pathToUri('/test/repo')

const createMockOctokit = (requestHandler: (route: string, options: any) => Promise<any>): Octokit => {
  return {
    request: requestHandler,
  } as any
}

const createMockOctokitConstructor = (mockOctokit: Octokit): any => {
  return class {
    constructor(_options: any) {
      return mockOctokit
    }
  }
}

test('updates both version and currentYear when both are outdated', async () => {
  const currentYear = new Date().getFullYear()
  const oldConfig = {
    currentYear: currentYear - 1,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const latestVersion = '0.80.0'
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  const expectedConfig = {
    currentYear,
    releaseUrlBase: oldConfig.releaseUrlBase,
    version: latestVersion,
  }

  expect(result).toEqual({
    branchName: 'feature/update-website-config',
    changedFiles: [
      {
        content: JSON.stringify(expectedConfig, null, 2) + '\n',
        path: 'packages/website/config.json',
      },
    ],
    commitMessage: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    pullRequestTitle: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    status: 'success',
    statusCode: 201,
  })
})

test('updates only version when year is already current', async () => {
  const currentYear = new Date().getFullYear()
  const oldConfig = {
    currentYear,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const latestVersion = '0.80.0'
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  const expectedConfig = {
    currentYear,
    releaseUrlBase: oldConfig.releaseUrlBase,
    version: latestVersion,
  }

  expect(result).toEqual({
    branchName: 'feature/update-website-config',
    changedFiles: [
      {
        content: JSON.stringify(expectedConfig, null, 2) + '\n',
        path: 'packages/website/config.json',
      },
    ],
    commitMessage: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    pullRequestTitle: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    status: 'success',
    statusCode: 201,
  })
})

test('updates only currentYear when version is already latest', async () => {
  const currentYear = new Date().getFullYear()
  const latestVersion = '0.80.0'
  const oldConfig = {
    currentYear: currentYear - 1,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: latestVersion,
  }

  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  const expectedConfig = {
    currentYear,
    releaseUrlBase: oldConfig.releaseUrlBase,
    version: latestVersion,
  }

  expect(result).toEqual({
    branchName: 'feature/update-website-config',
    changedFiles: [
      {
        content: JSON.stringify(expectedConfig, null, 2) + '\n',
        path: 'packages/website/config.json',
      },
    ],
    commitMessage: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    pullRequestTitle: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    status: 'success',
    statusCode: 201,
  })
})

test('returns empty result when both version and year are already up to date', async () => {
  const currentYear = new Date().getFullYear()
  const latestVersion = '0.80.0'
  const config = {
    currentYear,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: latestVersion,
  }

  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(config, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
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

test('fails when repository name is not lvce-editor.github.io', async () => {
  const mockOctokit = createMockOctokit(async () => {
    throw new Error('Should not be called')
  })

  const mockFs = createMockFs()

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'wrong-repo',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'This migration can only be run on repository "lvce-editor.github.io", but got "wrong-repo"',
    status: 'error',
    statusCode: 400,
  })
})

test('fails when config file does not exist', async () => {
  const mockOctokit = createMockOctokit(async () => {
    throw new Error('Should not be called')
  })

  const mockFs = createMockFs()

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Config file not found at packages/website/config.json',
    status: 'error',
    statusCode: 400,
  })
})

test('fails when no releases or tags found', async () => {
  const config = {
    currentYear: 2025,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      const error: any = new Error('Not Found')
      error.status = 404
      throw error
    }
    if (route === 'GET /repos/{owner}/{repo}/tags') {
      return {
        data: [],
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(config, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'No releases or tags found for lvce-editor/lvce-editor',
    status: 'error',
    statusCode: 400,
  })
})

test('handles tag fallback when no releases found', async () => {
  const currentYear = new Date().getFullYear()
  const oldConfig = {
    currentYear: currentYear - 1,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const latestVersion = 'v1.0.0'
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      const error: any = new Error('Not Found')
      error.status = 404
      throw error
    }
    if (route === 'GET /repos/{owner}/{repo}/tags') {
      return {
        data: [
          {
            name: latestVersion,
          },
        ],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/git/refs/tags/{ref}') {
      return {
        data: {
          object: {
            sha: 'tag-sha-123',
          },
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  const expectedConfig = {
    currentYear,
    releaseUrlBase: oldConfig.releaseUrlBase,
    version: latestVersion,
  }

  expect(result).toEqual({
    branchName: 'feature/update-website-config',
    changedFiles: [
      {
        content: JSON.stringify(expectedConfig, null, 2) + '\n',
        path: 'packages/website/config.json',
      },
    ],
    commitMessage: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    pullRequestTitle: `chore: update website config (version: ${latestVersion}, year: ${currentYear})`,
    status: 'success',
    statusCode: 201,
  })
})

test('handles GitHub API errors gracefully', async () => {
  const config = {
    currentYear: 2025,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const mockOctokit = createMockOctokit(async () => {
    const error: any = new Error('GitHub API Error')
    error.status = 500
    throw error
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(config, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  // getLatestRelease catches errors and returns null, so we get "No releases or tags found"
  expect(result.status).toBe('error')
  expect((result as MigrationErrorResult).errorCode).toBe('VALIDATION_ERROR')
  expect((result as MigrationErrorResult).errorMessage).toContain('No releases or tags found')
  expect(result.statusCode).toBe(400)
})

test('handles invalid JSON in config file', async () => {
  const mockOctokit = createMockOctokit(async () => {
    throw new Error('Should not be called')
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: 'invalid json content',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  expect(result.status).toBe('error')
  expect((result as MigrationErrorResult).errorCode).toBe('VALIDATION_ERROR')
  expect((result as MigrationErrorResult).errorMessage).toBeDefined()
})

test('preserves other config fields when updating', async () => {
  const currentYear = new Date().getFullYear()
  const oldConfig = {
    currentYear: currentYear - 1,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
    // Add extra field to ensure it's preserved
    extraField: 'should be preserved',
  }

  const latestVersion = '0.80.0'
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  const updatedContent = result.changedFiles[0].content
  const parsedConfig = JSON.parse(updatedContent)

  expect(parsedConfig.version).toBe(latestVersion)
  expect(parsedConfig.currentYear).toBe(currentYear)
  expect(parsedConfig.releaseUrlBase).toBe(oldConfig.releaseUrlBase)
  expect(parsedConfig.extraField).toBe('should be preserved')
})

test('handles version tags with v prefix', async () => {
  const currentYear = new Date().getFullYear()
  const oldConfig = {
    currentYear,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const latestVersion = 'v0.80.0'
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  const updatedContent = result.changedFiles[0].content
  const parsedConfig = JSON.parse(updatedContent)

  expect(parsedConfig.version).toBe(latestVersion)
  expect((result as MigrationSuccessResult).commitMessage).toContain(latestVersion)
})

test('handles version tags without v prefix', async () => {
  const currentYear = new Date().getFullYear()
  const oldConfig = {
    currentYear,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const latestVersion = '0.80.0'
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2) + '\n',
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  const updatedContent = result.changedFiles[0].content
  const parsedConfig = JSON.parse(updatedContent)

  expect(parsedConfig.version).toBe(latestVersion)
  expect((result as MigrationSuccessResult).commitMessage).toContain(latestVersion)
})

test('handles config file without trailing newline', async () => {
  const currentYear = new Date().getFullYear()
  const oldConfig = {
    currentYear: currentYear - 1,
    releaseUrlBase: 'https://github.com/lvce-editor/lvce-editor/releases/download',
    version: '0.70.0',
  }

  const latestVersion = '0.80.0'
  const mockOctokit = createMockOctokit(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases/latest') {
      return {
        data: {
          tag_name: latestVersion,
          target_commitish: 'sha123',
        },
      }
    }
    throw new Error(`Unexpected route: ${route}`)
  })

  const configPath = new URL('packages/website/config.json', clonedRepoUri + '/').toString()
  const mockFs = createMockFs({
    files: {
      [configPath]: JSON.stringify(oldConfig, null, 2), // No trailing newline
    },
  })

  const result = await updateWebsiteConfig({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    githubToken: 'test-token',
    OctokitConstructor: createMockOctokitConstructor(mockOctokit),
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })

  // Should add trailing newline in output
  expect(result.changedFiles[0].content).toMatch(/\n$/)
  const parsedConfig = JSON.parse(result.changedFiles[0].content.trim())
  expect(parsedConfig.version).toBe(latestVersion)
  expect(parsedConfig.currentYear).toBe(currentYear)
})

