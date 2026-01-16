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

test('replaces const rpc = EditorWorker.registerMockRpc with using rpc = EditorWorker.registerMockRpc', () => {
  const content = `
import { EditorWorker } from '../src/EditorWorker'

test('some test', () => {
  const rpc = EditorWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const expected = `
import { EditorWorker } from '../src/EditorWorker'

test('some test', () => {
  using rpc = EditorWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})

test('replaces const rpc = TextSearchWorker.registerMockRpc with using rpc = TextSearchWorker.registerMockRpc', () => {
  const content = `
import { TextSearchWorker } from '../src/TextSearchWorker'

test('some test', () => {
  const rpc = TextSearchWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const expected = `
import { TextSearchWorker } from '../src/TextSearchWorker'

test('some test', () => {
  using rpc = TextSearchWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})

test('replaces const rpc = FileSearchWorker.registerMockRpc with using rpc = FileSearchWorker.registerMockRpc', () => {
  const content = `
import { FileSearchWorker } from '../src/FileSearchWorker'

test('some test', () => {
  const rpc = FileSearchWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const expected = `
import { FileSearchWorker } from '../src/FileSearchWorker'

test('some test', () => {
  using rpc = FileSearchWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})

test('replaces const rpc = IframeWorker.registerMockRpc with using rpc = IframeWorker.registerMockRpc', () => {
  const content = `
import { IframeWorker } from '../src/IframeWorker'

test('some test', () => {
  const rpc = IframeWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const expected = `
import { IframeWorker } from '../src/IframeWorker'

test('some test', () => {
  using rpc = IframeWorker.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const result = replaceMockRpcPattern(content)
  expect(result).toBe(expected)
})

test('replaces const rpc = VirtualDom.registerMockRpc with using rpc = VirtualDom.registerMockRpc', () => {
  const content = `
import { VirtualDom } from '../src/VirtualDom'

test('some test', () => {
  const rpc = VirtualDom.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
})
`

  const expected = `
import { VirtualDom } from '../src/VirtualDom'

test('some test', () => {
  using rpc = VirtualDom.registerMockRpc({
    method: 'test',
    handler: () => 'result'
  })
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
  const rpc = EditorWorker.registerMockRpc({
    method: 'test2',
    handler: () => 'result2'
  })
})

test('test 3', () => {
  const rpc = TextSearchWorker.registerMockRpc({
    method: 'test3',
    handler: () => 'result3'
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
  using rpc = EditorWorker.registerMockRpc({
    method: 'test2',
    handler: () => 'result2'
  })
})

test('test 3', () => {
  using rpc = TextSearchWorker.registerMockRpc({
    method: 'test3',
    handler: () => 'result3'
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
