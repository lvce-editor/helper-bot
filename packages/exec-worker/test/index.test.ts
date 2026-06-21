import { expect, test } from '@jest/globals'
import { commandMap } from '../src/parts/CommandMap/CommandMap.ts'

test('creates a pull request to update versions when a release is created', async () => {
  expect(Object.keys(commandMap)).toEqual(['Exec.exec'])
})
