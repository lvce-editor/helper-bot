import { test, expect } from '@jest/globals'
import { updatePackageJsonDependencies } from '../src/parts/UpdatePackageJsonDependencies/UpdatePackageJsonDependencies.ts'

test('updates dependencies when both rpc and rpc-registry are present in dependencies', () => {
  const packageJson = {
    dependencies: {
      '@lvce-editor/rpc': '^4.20.0',
      '@lvce-editor/rpc-registry': '^6.1.0',
      'other-package': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const updated = updatePackageJsonDependencies({
    latestRpcRegistryVersion: '7.0.0',
    latestRpcVersion: '5.0.0',
    packageJson,
  })

  expect(updated).toBe(true)
  expect(packageJson.dependencies['@lvce-editor/rpc']).toBe('^5.0.0')
  expect(packageJson.dependencies['@lvce-editor/rpc-registry']).toBe('^7.0.0')
  expect(packageJson.dependencies['other-package']).toBe('^1.0.0')
})

test('updates dependencies when both rpc and rpc-registry are present in devDependencies', () => {
  const packageJson = {
    devDependencies: {
      '@lvce-editor/rpc': '^4.20.0',
      '@lvce-editor/rpc-registry': '^6.1.0',
      'other-package': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const updated = updatePackageJsonDependencies({
    latestRpcRegistryVersion: '7.0.0',
    latestRpcVersion: '5.0.0',
    packageJson,
  })

  expect(updated).toBe(true)
  expect(packageJson.devDependencies['@lvce-editor/rpc']).toBe('^5.0.0')
  expect(packageJson.devDependencies['@lvce-editor/rpc-registry']).toBe('^7.0.0')
  expect(packageJson.devDependencies['other-package']).toBe('^1.0.0')
})

test('updates dependencies when packages are split between dependencies and devDependencies', () => {
  const packageJson = {
    dependencies: {
      '@lvce-editor/rpc': '^4.20.0',
      'other-package': '^1.0.0',
    },
    devDependencies: {
      '@lvce-editor/rpc-registry': '^6.1.0',
      'dev-package': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const updated = updatePackageJsonDependencies({
    latestRpcRegistryVersion: '7.0.0',
    latestRpcVersion: '5.0.0',
    packageJson,
  })

  expect(updated).toBe(true)
  expect(packageJson.dependencies['@lvce-editor/rpc']).toBe('^5.0.0')
  expect(packageJson.devDependencies['@lvce-editor/rpc-registry']).toBe('^7.0.0')
  expect(packageJson.dependencies['other-package']).toBe('^1.0.0')
  expect(packageJson.devDependencies['dev-package']).toBe('^1.0.0')
})

test('returns false when no rpc dependencies are present', () => {
  const packageJson = {
    dependencies: {
      'other-package': '^1.0.0',
    },
    devDependencies: {
      'dev-package': '^1.0.0',
    },
    name: 'test-package',
    version: '1.0.0',
  }

  const updated = updatePackageJsonDependencies({
    latestRpcRegistryVersion: '7.0.0',
    latestRpcVersion: '5.0.0',
    packageJson,
  })

  expect(updated).toBe(false)
  expect(packageJson.dependencies['other-package']).toBe('^1.0.0')
  expect(packageJson.devDependencies['dev-package']).toBe('^1.0.0')
})

test('handles empty dependencies object', () => {
  const packageJson = {
    dependencies: {},
    devDependencies: {},
    name: 'test-package',
    version: '1.0.0',
  }

  const updated = updatePackageJsonDependencies({
    latestRpcRegistryVersion: '7.0.0',
    latestRpcVersion: '5.0.0',
    packageJson,
  })

  expect(updated).toBe(false)
})

test('handles missing dependencies sections', () => {
  const packageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  const updated = updatePackageJsonDependencies({
    latestRpcRegistryVersion: '7.0.0',
    latestRpcVersion: '5.0.0',
    packageJson,
  })

  expect(updated).toBe(false)
})
