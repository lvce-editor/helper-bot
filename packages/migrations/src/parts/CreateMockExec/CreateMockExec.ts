import type { ExecFunction } from '../Types/Types.ts'

export const createMockExec = (
  mockFn?: (file: string, args?: readonly string[], options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
): ExecFunction => {
  if (mockFn) {
    return mockFn as ExecFunction
  }
  return async () => {
    return { stdout: '', stderr: '', exitCode: 0 }
  }
}
