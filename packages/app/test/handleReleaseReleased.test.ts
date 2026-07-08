import { beforeEach, expect, jest, test } from '@jest/globals'

const mockUpdateBuiltinExtensions = jest.fn()
const mockUpdateDependencies = jest.fn()
const mockDispatchMigrationWorkflow = jest.fn()
const mockCaptureException = jest.fn()

jest.unstable_mockModule('../src/updateBuiltinExtensions.ts', () => ({
  updateBuiltinExtensions: mockUpdateBuiltinExtensions,
}))

jest.unstable_mockModule('../src/updateDependencies.ts', () => ({
  updateDependencies: mockUpdateDependencies,
}))

jest.unstable_mockModule('../src/getDependenciesConfig.ts', () => ({
  getDependenciesConfig: () => ({
    dependencies: [
      { fromRepo: 'lvce-editor', toRepo: 'editor-worker', toFolder: 'packages/server' },
      { fromRepo: 'test-worker', toRepo: 'lvce-editor', toFolder: 'packages/renderer-worker' },
      { fromRepo: 'process-explorer', toRepo: 'lvce-editor', toFolder: 'packages/shared-process' },
      { asName: 'process-explorer-worker', fromRepo: 'process-explorer', toRepo: 'lvce-editor', toFolder: 'packages/renderer-worker' },
    ],
  }),
}))

jest.unstable_mockModule('../src/parts/DispatchMigrationWorkflow/DispatchMigrationWorkflow.ts', () => ({
  dispatchMigrationWorkflow: mockDispatchMigrationWorkflow,
}))

jest.unstable_mockModule('../src/errorHandling.ts', () => ({
  captureException: mockCaptureException,
}))

const { handleReleaseReleased, shouldHandleRelease } = await import('../src/index.ts')
const PlannedReleaseBatch = await import('../src/parts/PlannedReleaseBatch/PlannedReleaseBatch.ts')

beforeEach(() => {
  mockUpdateBuiltinExtensions.mockResolvedValue(undefined)
  mockUpdateDependencies.mockResolvedValue(undefined)
  mockDispatchMigrationWorkflow.mockResolvedValue({
    requestId: 'request-1',
  })
  mockCaptureException.mockReset()
  mockUpdateBuiltinExtensions.mockClear()
  mockUpdateDependencies.mockClear()
  mockDispatchMigrationWorkflow.mockClear()
  PlannedReleaseBatch.resetPlannedReleaseBatch()
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

  expect(mockDispatchMigrationWorkflow).toHaveBeenCalledWith({
    app: undefined,
    migrationId: '/migrations2/update-website-config',
    migrationOptions: {
      releasedTag: 'v1.0.0',
    },
    targetRepository: 'lvce-editor/lvce-editor.github.io',
  })
})

test('does not call update-website-config migration for prereleases', async () => {
  const context = createContext('published', 'lvce-editor', { prerelease: true })

  await handleReleaseReleased(context)

  expect(mockDispatchMigrationWorkflow).not.toHaveBeenCalled()
})

test('does not call update-website-config migration for other repositories', async () => {
  const context = createContext('published', 'renderer-process')

  await handleReleaseReleased(context)

  expect(mockDispatchMigrationWorkflow).not.toHaveBeenCalled()
})

test('dispatches update-specific-dependency migrations for matching release dependencies', async () => {
  const context = createContext('published', 'test-worker')
  const app = {} as any

  await handleReleaseReleased(context, app)

  expect(mockDispatchMigrationWorkflow).toHaveBeenCalledWith({
    app,
    migrationId: '/migrations2/update-specific-dependency',
    migrationOptions: {
      fromRepo: 'test-worker',
      tagName: 'v1.0.0',
      toFolder: 'packages/renderer-worker',
      toRepo: 'lvce-editor',
    },
    targetRepository: 'lvce-editor/lvce-editor',
  })
})

test('collects matching planned release dependency updates instead of dispatching immediately', async () => {
  PlannedReleaseBatch.startPlannedReleaseBatch([
    {
      repository: 'lvce-editor/test-worker',
      tagName: 'v1.0.0',
    },
  ])
  const context = createContext('published', 'test-worker')
  const app = {} as any

  await handleReleaseReleased(context, app)

  expect(mockDispatchMigrationWorkflow).not.toHaveBeenCalled()
  expect(PlannedReleaseBatch.markPlannedReleaseCompleted('lvce-editor/test-worker', 'v1.0.0')).toEqual([
    {
      targetRepository: 'lvce-editor/lvce-editor',
      toRepo: 'lvce-editor',
      updates: [
        {
          fromRepo: 'test-worker',
          tagName: 'v1.0.0',
          toFolder: 'packages/renderer-worker',
          toRepo: 'lvce-editor',
        },
      ],
    },
  ])
})

test('dispatches process-explorer updates for shared-process and renderer-worker packages', async () => {
  const context = createContext('published', 'process-explorer')
  const app = {} as any

  await handleReleaseReleased(context, app)

  expect(mockDispatchMigrationWorkflow).toHaveBeenCalledWith({
    app,
    migrationId: '/migrations2/update-specific-dependency',
    migrationOptions: {
      fromRepo: 'process-explorer',
      tagName: 'v1.0.0',
      toFolder: 'packages/shared-process',
      toRepo: 'lvce-editor',
    },
    targetRepository: 'lvce-editor/lvce-editor',
  })
  expect(mockDispatchMigrationWorkflow).toHaveBeenCalledWith({
    app,
    migrationId: '/migrations2/update-specific-dependency',
    migrationOptions: {
      asName: 'process-explorer-worker',
      fromRepo: 'process-explorer',
      tagName: 'v1.0.0',
      toFolder: 'packages/renderer-worker',
      toRepo: 'lvce-editor',
    },
    targetRepository: 'lvce-editor/lvce-editor',
  })
})
