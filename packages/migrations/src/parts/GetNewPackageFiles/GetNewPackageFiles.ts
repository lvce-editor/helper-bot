import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface GetNewPackageFilesParams {
  oldPackageJson: any
  dependencyName: string
  dependencyKey: string
  newVersion: string
}

export interface GetNewPackageFilesResult {
  newPackageJsonString: string
  newPackageLockJsonString: string
}

export const getNewPackageFiles = async (
  params: GetNewPackageFilesParams,
): Promise<GetNewPackageFilesResult> => {
  const { oldPackageJson, dependencyName, dependencyKey, newVersion } = params
  const name = oldPackageJson.name
  const tmpFolder = join(
    tmpdir(),
    `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp`,
  )
  const tmpCacheFolder = join(
    tmpdir(),
    `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp-cache`,
  )
  const toRemove = [tmpFolder, tmpCacheFolder]
  try {
    oldPackageJson[dependencyKey][`@lvce-editor/${dependencyName}`] =
      `^${newVersion}`
    const oldPackageJsonStringified =
      JSON.stringify(oldPackageJson, null, 2) + '\n'
    await mkdir(tmpFolder, { recursive: true })
    await writeFile(join(tmpFolder, 'package.json'), oldPackageJsonStringified)
    const { execa } = await import('execa')
    await execa(
      `npm`,
      [
        'install',
        '--ignore-scripts',
        '--prefer-online',
        '--cache',
        tmpCacheFolder,
      ],
      {
        cwd: tmpFolder,
      },
    )
    const newPackageLockJsonString = await readFile(
      join(tmpFolder, 'package-lock.json'),
      'utf8',
    )
    return {
      newPackageJsonString: oldPackageJsonStringified,
      newPackageLockJsonString,
    }
  } catch (error) {
    throw new Error(`Failed to update dependencies: ${error}`)
  } finally {
    for (const folder of toRemove) {
      await rm(folder, {
        recursive: true,
        force: true,
      })
    }
  }
}
