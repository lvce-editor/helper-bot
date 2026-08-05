import { expect, test } from '@jest/globals'
import { getDependenciesConfig } from '../src/getDependenciesConfig.ts'

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
