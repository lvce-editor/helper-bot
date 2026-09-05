import { expect, test } from '@jest/globals'
import { getDependenciesConfig } from '../src/getDependenciesConfig.ts'

test.each([
  'component-state-worker',
  'explorer-view',
  'extension-detail-view',
  'extension-search-view',
  'main-area-worker',
  'simple-browser-view',
  'status-bar-worker',
  'text-search-view',
  'title-bar-worker',
])('tracks %s releases in renderer-worker', (fromRepo) => {
  const { dependencies } = getDependenciesConfig()

  expect(dependencies.filter((dependency) => dependency.fromRepo === fromRepo && dependency.toRepo === 'lvce-editor')).toEqual([
    { fromRepo, toFolder: 'packages/renderer-worker', toRepo: 'lvce-editor' },
  ])
})

test('tracks the current drag and drop worker dependency', () => {
  const { dependencies } = getDependenciesConfig()

  expect(dependencies).toContainEqual({
    fromRepo: 'drag-and-drop-worker',
    toFolder: 'packages/renderer-worker',
    toRepo: 'lvce-editor',
  })
  expect(dependencies).not.toContainEqual(
    expect.objectContaining({
      fromRepo: 'extension-host-worker',
      toRepo: 'lvce-editor',
    }),
  )
})
