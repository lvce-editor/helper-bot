import type { ExecFunction } from '../Types/Types.ts'
import { validateUri } from '../UriUtils/UriUtils.ts'

export const createMockExec = (
  mockFn?: (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
): ExecFunction => {
  if (mockFn) {
    return ((file: string, args?: readonly string[], options?: { cwd?: string }) => {
      if (options?.cwd) {
        validateUri(options.cwd, 'exec cwd')
      }
      return mockFn(file, args, options)
    }) as ExecFunction
  }
  return async (file: string, args?: readonly string[], options?: { cwd?: string }) => {
    if (options?.cwd) {
      validateUri(options.cwd, 'exec cwd')
    }
    return { exitCode: 0, stderr: '', stdout: '' }
  }
}
