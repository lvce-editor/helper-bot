import * as Assert from '@lvce-editor/assert'
import { execa } from 'execa'
import { uriToPath } from '../UriUtils/UriUtils.ts'

export interface ExecResult {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
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
    exitCode: result.exitCode ?? 129,
    stderr: result.stderr,
    stdout: result.stdout,
  }
}
