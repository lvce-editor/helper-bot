import { test, expect, jest } from '@jest/globals'

const mockExeca = {
  execa: jest.fn(),
}

const mockFs = {
  mkdir: jest.fn(),
  readFile: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
}

jest.unstable_mockModule('execa', () => mockExeca)
jest.unstable_mockModule('node:fs/promises', () => mockFs)
jest.unstable_mockModule('node:os', () => ({
  tmpdir: () => '/test',
}))

const { getNewPackageFiles } = await import(
  '../src/parts/GetNewPackageFiles/GetNewPackageFiles.ts'
)

test('generates new package files with updated dependency', async () => {
  const oldPackageJson = {
    name: 'test-package',
    version: '1.0.0',
    dependencies: {
      '@lvce-editor/test-dependency': '^1.0.0',
    },
  }

  const mockPackageLockJson = JSON.stringify(
    {
      name: 'test-package',
      version: '1.0.0',
      lockfileVersion: 3,
      dependencies: {
        '@lvce-editor/test-dependency': {
          version: '2.0.0',
        },
      },
    },
    null,
    2,
  )

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdir.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.writeFile.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(mockPackageLockJson)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await getNewPackageFiles({
    repository: 'test/repo',
    oldPackageJson,
    dependencyName: 'test-dependency',
    dependencyKey: 'dependencies',
    newVersion: '2.0.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].path).toBe('package.json')
  expect(result.changedFiles[0].content).toContain(
    '"@lvce-editor/test-dependency": "^2.0.0"',
  )
  expect(result.changedFiles[1].path).toBe('package-lock.json')
  expect(result.changedFiles[1].content).toBe(mockPackageLockJson)
  expect(result.pullRequestTitle).toBe(
    'feature: update test-dependency to version 2.0.0',
  )

  // Verify execa was called with npm install
  expect(mockExeca.execa).toHaveBeenCalledWith(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--prefer-online',
      '--cache',
      expect.any(String),
    ],
    expect.objectContaining({
      cwd: expect.any(String),
    }),
  )
})

test('handles devDependencies', async () => {
  const oldPackageJson = {
    name: 'test-package',
    version: '1.0.0',
    devDependencies: {
      '@lvce-editor/test-dev-dependency': '^1.0.0',
    },
  }

  const mockPackageLockJson = JSON.stringify({
    name: 'test-package',
    version: '1.0.0',
  })

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdir.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.writeFile.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(mockPackageLockJson)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await getNewPackageFiles({
    repository: 'test/repo',
    oldPackageJson,
    dependencyName: 'test-dev-dependency',
    dependencyKey: 'devDependencies',
    newVersion: '2.0.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(2)
  expect(result.changedFiles[0].content).toContain(
    '"@lvce-editor/test-dev-dependency": "^2.0.0"',
  )
})

test('handles error when npm install fails', async () => {
  const oldPackageJson = {
    name: 'test-package',
    version: '1.0.0',
    dependencies: {
      '@lvce-editor/test-dependency': '^1.0.0',
    },
  }

  // @ts-ignore
  mockExeca.execa.mockRejectedValue(new Error('npm install failed'))
  // @ts-ignore
  mockFs.mkdir.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.writeFile.mockResolvedValue(undefined)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await getNewPackageFiles({
    repository: 'test/repo',
    oldPackageJson,
    dependencyName: 'test-dependency',
    dependencyKey: 'dependencies',
    newVersion: '2.0.0',
    packageJsonPath: 'package.json',
    packageLockJsonPath: 'package-lock.json',
  })

  expect(result.status).toBe('error')
  expect(result.changedFiles).toEqual([])
  expect(result.errorCode).toBe('GET_NEW_PACKAGE_FILES_FAILED')
  expect(result.errorMessage).toContain('npm install failed')
})
