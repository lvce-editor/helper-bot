import { beforeEach, expect, jest, test } from '@jest/globals'

const mockUpdateBuiltinExtensions = jest.fn()
const mockUpdateDependencies = jest.fn()
const mockInvoke = jest.fn()
const mockCaptureException = jest.fn()

jest.unstable_mockModule('../src/updateBuiltinExtensions.ts', () => ({
  updateBuiltinExtensions: mockUpdateBuiltinExtensions,
}))

jest.unstable_mockModule('../src/updateDependencies.ts', () => ({
  updateDependencies: mockUpdateDependencies,
}))

jest.unstable_mockModule('../src/getDependenciesConfig.ts', () => ({
  getDependenciesConfig: () => ({
    dependencies: [{ fromRepo: 'lvce-editor', toRepo: 'editor-worker', toFolder: 'packages/server' }],
  }),
}))

jest.unstable_mockModule('../src/migrationsWorker.ts', () => ({
  invoke: mockInvoke,
}))

jest.unstable_mockModule('../src/errorHandling.ts', () => ({
  captureException: mockCaptureException,
}))

const { handleReleaseReleased, shouldHandleRelease } = await import('../src/index.ts')

beforeEach(() => {
  mockUpdateBuiltinExtensions.mockResolvedValue(undefined)
  mockUpdateDependencies.mockResolvedValue(undefined)
  mockInvoke.mockResolvedValue({
    type: 'success',
    status: 'success',
  })
  mockCaptureException.mockReset()
  mockUpdateBuiltinExtensions.mockClear()
  mockUpdateDependencies.mockClear()
  mockInvoke.mockClear()
})

const createContext = (action: string, repositoryName: string, release: Record<string, unknown> = {}) => {
  return {
    payload: {
      action,
      release: {
        tag_name: 'v1.0.0',
        draft: false,
        prerelease: false,
        ...release,
      },
      repository: {
        name: repositoryName,
        owner: {
          login: 'lvce-editor',
        },
      },
    },
    octokit: {
      auth: jest.fn().mockResolvedValue({ token: 'test-token' }),
    },
  } as any
}

test('should handle created final releases', () => {
  const context = createContext('created', 'lvce-editor')
  expect(shouldHandleRelease(context)).toBe(true)
})

test('should handle published final releases', () => {
  const context = createContext('published', 'lvce-editor')
  expect(shouldHandleRelease(context)).toBe(true)
})

test('should not handle prereleases', () => {
  const context = createContext('published', 'lvce-editor', { prerelease: true })
  expect(shouldHandleRelease(context)).toBe(false)
})

test('calls update-website-config migration when lvce-editor is published', async () => {
  const context = createContext('published', 'lvce-editor')

  await handleReleaseReleased(context)

  expect(context.octokit.auth).toHaveBeenCalledWith({
    type: 'installation',
  })
  expect(mockInvoke).toHaveBeenCalledWith('/migrations2/update-website-config', {
    githubToken: 'test-token',
    repositoryName: 'lvce-editor.github.io',
    repositoryOwner: 'lvce-editor',
  })
})

test('does not call update-website-config migration for prereleases', async () => {
  const context = createContext('published', 'lvce-editor', { prerelease: true })

  await handleReleaseReleased(context)

  expect(context.octokit.auth).not.toHaveBeenCalled()
  expect(mockInvoke).not.toHaveBeenCalled()
})

test('does not call update-website-config migration for other repositories', async () => {
  const context = createContext('published', 'renderer-process')

  await handleReleaseReleased(context)

  expect(context.octokit.auth).not.toHaveBeenCalled()
  expect(mockInvoke).not.toHaveBeenCalled()
})
