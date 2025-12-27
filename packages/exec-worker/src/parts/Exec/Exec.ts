import { execa } from 'execa'
import { uriToPath } from '../UriUtils/UriUtils.ts'
import * as Assert from '@lvce-editor/assert'

export interface ExecResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export const exec = async (file: string, args: readonly string[], options: { cwd?: string; env?: any } = {}): Promise<ExecResult> => {
  Assert.string(file)
  Assert.array(args)
  Assert.object(options)
  const cwd = options?.cwd ? uriToPath(options.cwd) : undefined
  const extraEnv = options?.env || {}
  const env = {
    ...process.env,
    ...extraEnv,
  }
  const result = await execa(file, args, { cwd, env })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 129,
  }
}
