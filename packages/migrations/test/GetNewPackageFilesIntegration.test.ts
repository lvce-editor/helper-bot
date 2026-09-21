import { expect, test } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { BaseMigrationOptions } from '../src/parts/Types/Types.ts'
import { getNewPackageFiles } from '../src/parts/GetNewPackageFiles/GetNewPackageFiles.ts'

// Production's filesystem adapter accepts URI strings; native fs requires URL objects.
const uriFs = {
  ...fs,
  mkdir: (path: string, options: any) => fs.mkdir(new URL(path), options),
  readdir: (path: string, options: any) => fs.readdir(new URL(path), options),
  readFile: (path: string, encoding: BufferEncoding) => fs.readFile(new URL(path), encoding),
  rm: (path: string, options: any) => fs.rm(new URL(path), options),
  writeFile: (path: string, content: string) => fs.writeFile(new URL(path), content),
} as BaseMigrationOptions['fs']

test('produces a workspace update that passes real npm ci offline', async () => {
  const folder = await fs.mkdtemp(join(tmpdir(), 'helper-workspace-integration-'))
  const clonedRepoUri = pathToFileURL(folder).href + '/'
  // Use the npm bundled with the Node installation running this test.
  const npmExecutable =
    process.platform === 'win32'
      ? join(process.execPath, '..', 'node_modules/npm/bin/npm-cli.js')
      : join(process.execPath, '../../lib/node_modules/npm/bin/npm-cli.js')
  const runNpm = (args: readonly string[], cwd: string): string =>
    execFileSync(process.execPath, [npmExecutable, ...args, '--offline', '--no-audit', '--no-fund'], { cwd, encoding: 'utf8' })
  try {
    await fs.mkdir(join(folder, 'modules/renderer'), { recursive: true })
    await fs.mkdir(join(folder, 'modules/shared'), { recursive: true })
    await fs.writeFile(join(folder, 'package.json'), JSON.stringify({ name: 'root', private: true, workspaces: ['modules/*'] }))
    await fs.writeFile(join(folder, 'modules/renderer/package.json'), JSON.stringify({ dependencies: { '@lvce-editor/shared': '^1.0.0' }, name: 'renderer' }))
    await fs.writeFile(join(folder, 'modules/shared/package.json'), JSON.stringify({ name: '@lvce-editor/shared', version: '1.0.0' }))
    runNpm(['install', '--package-lock-only', '--ignore-scripts'], folder)
    await fs.writeFile(join(folder, 'modules/shared/package.json'), JSON.stringify({ name: '@lvce-editor/shared', version: '2.0.0' }))
    const result = await getNewPackageFiles({
      clonedRepoUri,
      dependencyKey: 'dependencies',
      dependencyName: 'shared',
      exec: async (_file, args, options) => ({ exitCode: 0, stderr: '', stdout: runNpm(args!, fileURLToPath(options!.cwd!)) }),
      fetch: globalThis.fetch,
      fs: uriFs,
      newVersion: '2.0.0',
      packageJsonPath: 'modules/renderer/package.json',
      packageLockJsonPath: 'modules/renderer/package-lock.json',
      repositoryName: 'repo',
      repositoryOwner: 'test',
    })
    expect(result.status).toBe('success')
    expect(result.changedFiles.map(({ path }) => path).toSorted((a, b) => a.localeCompare(b))).toEqual(['modules/renderer/package.json', 'package-lock.json'])
    for (const { content, path } of result.changedFiles) {
      await fs.writeFile(join(folder, path), content)
    }
    runNpm(['ci', '--ignore-scripts'], folder)
    const lock = JSON.parse(await fs.readFile(join(folder, 'package-lock.json'), 'utf8'))
    expect(lock.packages['modules/renderer'].dependencies['@lvce-editor/shared']).toBe('^2.0.0')
  } finally {
    await fs.rm(folder, { force: true, recursive: true })
  }
}, 30_000)
