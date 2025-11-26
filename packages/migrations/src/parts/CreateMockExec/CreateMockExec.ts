import type { ExecFunction } from '../Types/Types.ts'

export const createMockExec = (
  implementation?: (
    file: string,
    args?: readonly string[],
    options?: { cwd?: string },
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
): ExecFunction => {
  return async (file, args, options) => {
    if (implementation) {
      return await implementation(file, args, options)
    }
    return { stdout: '', stderr: '', exitCode: 0 }
  }
}
