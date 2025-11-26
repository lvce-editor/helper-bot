import { test, expect } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { getNewPackageFiles } from '../src/parts/GetNewPackageFiles/GetNewPackageFiles.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.skip('generates new package files with updated dependency', async () => {
  // This test requires a real npm package and npm install, which is slow
  // and may fail if the package doesn't exist. Skipping for now.
  const oldPackageJson = {
    name: 'test-package',
    version: '1.0.0',
    dependencies: {
      '@lvce-editor/shared': '^1.0.0',
    },
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify(oldPackageJson, null, 2) + '\n',
    )

    const result = await getNewPackageFiles({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      dependencyName: 'shared',
      dependencyKey: 'dependencies',
      newVersion: '2.0.0',
      packageJsonPath: 'package.json',
      packageLockJsonPath: 'package-lock.json',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles.length).toBeGreaterThanOrEqual(1)
    expect(result.changedFiles[0].path).toBe('package.json')
    expect(result.changedFiles[0].content).toContain(
      '"@lvce-editor/shared": "^2.0.0"',
    )
    if (result.changedFiles.length > 1) {
      expect(result.changedFiles[1].path).toBe('package-lock.json')
      expect(result.changedFiles[1].content).toBeTruthy()
    }
    expect(result.pullRequestTitle).toBe(
      'feature: update shared to version 2.0.0',
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('handles missing package.json', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    const result = await getNewPackageFiles({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      dependencyName: 'test-dependency',
      dependencyKey: 'dependencies',
      newVersion: '2.0.0',
      packageJsonPath: 'package.json',
      packageLockJsonPath: 'package-lock.json',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
