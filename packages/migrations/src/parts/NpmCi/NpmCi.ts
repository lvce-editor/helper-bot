import type { ExecFunction } from '../Types/Types.ts'

export const npmCi = async (uri: string, exec: ExecFunction): Promise<{ exitCode: number; stderr: string }> => {
  const result = await exec('npm', ['ci', '--ignore-scripts'], {
    cwd: uri,
    // @ts-ignore
    env: {
      NODE_OPTIONS: '--max_old_space_size=150',
      NODE_ENV: '',
    },
  })
  try {
    console.info(`[npm] Running postinstall`)
    await exec('npm', ['run', 'postinstall'], {
      cwd: uri,
      // @ts-ignore
      env: {
        NODE_OPTIONS: '--max_old_space_size=150',
        NODE_ENV: '',
      },
    })
  } catch {
    // ignore
  }
  return {
    exitCode: result.exitCode,
    stderr: result.stderr,
  }
}
