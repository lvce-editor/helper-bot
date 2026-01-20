import type { ExecFunction } from '../Types/Types.ts'

export const npmInstall = async (uri: string, exec: ExecFunction): Promise<{ exitCode: number; stderr: string }> => {
  const result = await exec('npm', ['install', '--ignore-scripts'], {
    cwd: uri,
    // @ts-ignore
    env: {
      NODE_ENV: '',
      NODE_OPTIONS: '--max_old_space_size=300',
    },
  })
  try {
    console.info(`[npm] Running postinstall`)
    await exec('npm', ['run', 'postinstall'], {
      cwd: uri,
      // @ts-ignore
      env: {
        NODE_ENV: '',
        NODE_OPTIONS: '--max_old_space_size=300',
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
