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
    oldPackageJson,
    dependencyName: 'test-dependency',
    dependencyKey: 'dependencies',
    newVersion: '2.0.0',
  })

  expect(result.newPackageJsonString).toContain(
    '"@lvce-editor/test-dependency": "^2.0.0"',
  )
  expect(result.newPackageLockJsonString).toBe(mockPackageLockJson)

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
    oldPackageJson,
    dependencyName: 'test-dev-dependency',
    dependencyKey: 'devDependencies',
    newVersion: '2.0.0',
  })

  expect(result.newPackageJsonString).toContain(
    '"@lvce-editor/test-dev-dependency": "^2.0.0"',
  )
})

test('throws error when npm install fails', async () => {
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

  await expect(
    getNewPackageFiles({
      oldPackageJson,
      dependencyName: 'test-dependency',
      dependencyKey: 'dependencies',
      newVersion: '2.0.0',
    }),
  ).rejects.toThrow('Failed to update dependencies: Error: npm install failed')
})
