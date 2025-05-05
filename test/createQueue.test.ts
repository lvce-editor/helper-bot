import { test, expect } from '@jest/globals'
import { createQueue } from '../src/createQueue.js'

test('processes items in order', async () => {
  const processedItems: number[] = []
  const { addToQueue } = createQueue<number>(async (item) => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    processedItems.push(item)
  })

  await Promise.all([addToQueue(1), addToQueue(2), addToQueue(3)])

  // Wait for all items to be processed
  await new Promise((resolve) => setTimeout(resolve, 100))

  expect(processedItems).toEqual([1, 2, 3])
})

test('handles errors gracefully', async () => {
  const processedItems: number[] = []
  const { addToQueue } = createQueue<number>(async (item) => {
    if (item === 2) {
      throw new Error('Test error')
    }
    processedItems.push(item)
  })

  await Promise.all([addToQueue(1), addToQueue(2), addToQueue(3)])

  // Wait for all items to be processed
  await new Promise((resolve) => setTimeout(resolve, 100))

  expect(processedItems).toEqual([1, 3])
})

test('processes one item at a time', async () => {
  let isProcessing = false
  const { addToQueue } = createQueue<number>(async (item) => {
    expect(isProcessing).toBe(false)
    isProcessing = true
    await new Promise((resolve) => setTimeout(resolve, 10))
    isProcessing = false
  })

  await Promise.all([addToQueue(1), addToQueue(2), addToQueue(3)])

  // Wait for all items to be processed
  await new Promise((resolve) => setTimeout(resolve, 100))
})
