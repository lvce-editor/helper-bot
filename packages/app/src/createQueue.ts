import { captureException } from '../migrations/src/index.js'

type QueueContext<T> = {
  queue: T[]
  isProcessing: boolean
}

export const createQueue = <T>(handleItem: (item: T) => Promise<void>) => {
  const context: QueueContext<T> = {
    queue: [],
    isProcessing: false,
  }

  const processQueue = async () => {
    if (context.queue.length === 0) {
      context.isProcessing = false
      return
    }

    context.isProcessing = true
    const item = context.queue[0]

    try {
      await handleItem(item)
    } catch (error) {
      captureException(error as Error)
    }

    context.queue.shift()
    await processQueue()
  }

  const addToQueue = async (item: T) => {
    context.queue.push(item)
    if (!context.isProcessing) {
      await processQueue()
    }
  }

  return { addToQueue }
}
