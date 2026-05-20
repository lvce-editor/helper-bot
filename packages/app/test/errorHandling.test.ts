import { afterAll, expect, jest, test } from '@jest/globals'

const mockSentry = {
  captureException: jest.fn(),
  init: jest.fn(),
}

jest.unstable_mockModule('@sentry/node', () => mockSentry)

const originalSentryDsn = process.env.SENTRY_DSN
process.env.SENTRY_DSN = 'https://example@sentry.invalid/1'

const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
const { captureException } = await import('../src/errorHandling.ts')

afterAll(() => {
  process.env.SENTRY_DSN = originalSentryDsn
  consoleError.mockRestore()
})

test('does not initialize a second sentry sdk at import time', () => {
  expect(mockSentry.init).not.toHaveBeenCalled()
})

test('logs captured exceptions without throwing', () => {
  const error = new Error('test-error')

  expect(() => captureException(error)).not.toThrow()
  expect(consoleError).toHaveBeenCalledWith(error)
})
