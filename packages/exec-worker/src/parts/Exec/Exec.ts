import { execa } from 'execa'

export interface ExecOptions {
  readonly command: string
  readonly args?: readonly string[]
  readonly cwd?: string
  readonly env?: Record<string, string>
}

export interface ExecResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export const exec = async (options: ExecOptions): Promise<ExecResult> => {
  const { command, args = [], cwd, env } = options
  const result = await execa(command, args, {
    cwd,
    env,
  })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 129,
  }
}
