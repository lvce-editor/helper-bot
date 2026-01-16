import { test, expect } from '@jest/globals'
import { replaceMockRpcPattern } from '../src/parts/ReplaceMockRpcPattern/ReplaceMockRpcPattern.ts'

test('replaces const rpc = RendererWorker.registerMockRpc with using rpc = RendererWorker.registerMockRpc', () => {
  const content = `
import { RendererWorker } from '../src/RendererWorker'

test('some test', () => {
  const rpc = RendererWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })

  // test logic here
})
`

  const expected = `
import { RendererWorker } from '../src/RendererWorker'

test('some test', () => {
  using rpc = RendererWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })

  // test logic here
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})

test('replaces multiple occurrences', () => {
  const content = `
test('test 1', () => {
  const rpc = RendererWorker.registerMockRpc({
    method: 'test1',
    handler: () => 'result1'
  })
})

test('test 2', () => {
  const rpc = RendererWorker.registerMockRpc({
    method: 'test2',
    handler: () => 'result2'
  })
})
`

  const expected = `
test('test 1', () => {
  using rpc = RendererWorker.registerMockRpc({
    method: 'test1',
    handler: () => 'result1'
  })
})

test('test 2', () => {
  using rpc = RendererWorker.registerMockRpc({
    method: 'test2',
    handler: () => 'result2'
  })
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})

test('does not replace other const declarations', () => {
  const content = `
const otherVar = 'some value'
const rpc = SomeOtherFunction()
const anotherRpc = RendererWorker.registerMockRpc({
  method: 'test',
  handler: () => 'result'
})
`

  const expected = `
const otherVar = 'some value'
const rpc = SomeOtherFunction()
const anotherRpc = RendererWorker.registerMockRpc({
  method: 'test',
  handler: () => 'result'
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})

test('handles content with no matches', () => {
  const content = `
import { RendererWorker } from '../src/RendererWorker'

test('some test', () => {
  const otherVar = 'some value'
  const result = someFunction()
  expect(result).toBe('expected')
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(content)
})

test('handles empty content', () => {
  const content = ''
  const result = replaceMockRpcPattern(content)
  expect(result).toBe(content)
})

test('handles whitespace variations', () => {
  const content = `
const rpc=RendererWorker.registerMockRpc({
  method: 'test1',
  handler: () => 'result1'
})

const rpc = RendererWorker.registerMockRpc({
  method: 'test2',
  handler: () => 'result2'
})

const rpc =    RendererWorker.registerMockRpc({
  method: 'test3',
  handler: () => 'result3'
})
`

  const expected = `
using rpc = RendererWorker.registerMockRpc({
  method: 'test1',
  handler: () => 'result1'
})

using rpc = RendererWorker.registerMockRpc({
  method: 'test2',
  handler: () => 'result2'
})

using rpc = RendererWorker.registerMockRpc({
  method: 'test3',
  handler: () => 'result3'
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})
