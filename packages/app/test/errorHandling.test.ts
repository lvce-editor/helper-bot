import { afterAll, expect, jest, test } from '@jest/globals'

const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
const { captureException } = await import('../src/errorHandling.ts')

afterAll(() => {
  consoleError.mockRestore()
})

test('does not log at import time', () => {
  expect(consoleError).not.toHaveBeenCalled()
})

test('logs captured exceptions without throwing', () => {
  const error = new Error('test-error')

  expect(() => captureException(error)).not.toThrow()
  expect(consoleError).toHaveBeenCalledWith(error)
})
