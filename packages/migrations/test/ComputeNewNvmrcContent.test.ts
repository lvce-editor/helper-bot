import { test, expect } from '@jest/globals'
import { computeNewNvmrcContent } from '../src/parts/ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'

test('computes new nvmrc content when version should be updated', async () => {
  const result = await computeNewNvmrcContent({
    repository: 'test/repo',
    currentContent: 'v18.0.0',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.nvmrc')
  expect(result.changedFiles[0].content).toBe('v20.0.0\n')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('returns same content when existing version is newer', async () => {
  const result = await computeNewNvmrcContent({
    repository: 'test/repo',
    currentContent: 'v22.0.0',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('handles version without v prefix', async () => {
  const result = await computeNewNvmrcContent({
    repository: 'test/repo',
    currentContent: '18.0.0',
    newVersion: '20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toBe('20.0.0\n')
})

test('handles version with v prefix in newVersion', async () => {
  const result = await computeNewNvmrcContent({
    repository: 'test/repo',
    currentContent: '18.0.0',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toBe('v20.0.0\n')
})

test('handles same version', async () => {
  const result = await computeNewNvmrcContent({
    repository: 'test/repo',
    currentContent: 'v20.0.0\n',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles invalid current content gracefully', async () => {
  const result = await computeNewNvmrcContent({
    repository: 'test/repo',
    currentContent: 'invalid',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toBe('v20.0.0\n')
})

test('handles empty current content', async () => {
  const result = await computeNewNvmrcContent({
    repository: 'test/repo',
    currentContent: '',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toBe('v20.0.0\n')
})
