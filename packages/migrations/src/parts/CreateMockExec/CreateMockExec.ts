import type { ExecFunction } from '../Types/Types.ts'
import { validateUri } from '../UriUtils/UriUtils.ts'

const defaultMockExec = async (
  _file: string,
  _args?: readonly string[],
  options?: Readonly<{ cwd?: string }>,
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  if (options?.cwd) {
    validateUri(options.cwd, 'exec cwd')
  }
  return { exitCode: 0, stderr: '', stdout: '' }
}

export const createMockExec = (
  mockFn?: (file: string, args?: readonly string[], options?: Readonly<{ cwd?: string }>) => Promise<{ exitCode: number; stderr: string; stdout: string }>,
): ExecFunction => {
  if (mockFn) {
    return ((file: string, args?: readonly string[], options?: Readonly<{ cwd?: string }>) => {
      if (options?.cwd) {
        validateUri(options.cwd, 'exec cwd')
      }
      return mockFn(file, args, options)
    }) as ExecFunction
  }
  return defaultMockExec
}
