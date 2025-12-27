import { execa } from 'execa'
import { existsSync, readdirSync } from 'node:fs'
import { cp, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { root } from './root.ts'

const moveDistSrcToDist = async (packagePath: string): Promise<void> => {
  const distPath = join(packagePath, 'dist')
  const distSrcPath = join(distPath, 'src')
  const dist2Path = join(packagePath, 'dist2')

  if (!existsSync(distSrcPath)) {
    return
  }

  await rename(distPath, dist2Path)
  await cp(join(dist2Path, 'src'), distPath, { recursive: true })
  await rm(dist2Path, { recursive: true })
}

const runTsc = async (): Promise<void> => {
  await execa('tsc', ['-b'], {
    cwd: root,
    stdio: 'inherit',
  })
}

const main = async (): Promise<void> => {
  await runTsc()

  const packagesFolder = join(root, 'packages')
  const dirents = readdirSync(packagesFolder, { withFileTypes: true })

  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      const packagePath = join(packagesFolder, dirent.name)
      const packageJsonPath = join(packagePath, 'package.json')
      if (existsSync(packageJsonPath)) {
        await moveDistSrcToDist(packagePath)
      }
    }
  }
}

main()
