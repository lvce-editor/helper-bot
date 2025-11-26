import { test, expect } from '@jest/globals'
import { computeNewNvmrcContent } from '../src/parts/ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'

test('computes new nvmrc content when version should be updated', () => {
  const result = computeNewNvmrcContent({
    currentContent: 'v18.0.0',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('v20.0.0\n')
  expect(result.shouldUpdate).toBe(true)
})

test('returns same content when existing version is newer', () => {
  const result = computeNewNvmrcContent({
    currentContent: 'v22.0.0',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('v22.0.0')
  expect(result.shouldUpdate).toBe(false)
})

test('handles version without v prefix', () => {
  const result = computeNewNvmrcContent({
    currentContent: '18.0.0',
    newVersion: '20.0.0',
  })

  expect(result.newContent).toBe('20.0.0\n')
  expect(result.shouldUpdate).toBe(true)
})

test('handles version with v prefix in newVersion', () => {
  const result = computeNewNvmrcContent({
    currentContent: '18.0.0',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('v20.0.0\n')
  expect(result.shouldUpdate).toBe(true)
})

test('handles same version', () => {
  const result = computeNewNvmrcContent({
    currentContent: 'v20.0.0',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('v20.0.0\n')
  expect(result.shouldUpdate).toBe(true)
})

test('handles invalid current content gracefully', () => {
  const result = computeNewNvmrcContent({
    currentContent: 'invalid',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('v20.0.0\n')
  expect(result.shouldUpdate).toBe(true)
})

test('handles empty current content', () => {
  const result = computeNewNvmrcContent({
    currentContent: '',
    newVersion: 'v20.0.0',
  })

  expect(result.newContent).toBe('v20.0.0\n')
  expect(result.shouldUpdate).toBe(true)
})
