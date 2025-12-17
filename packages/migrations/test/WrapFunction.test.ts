import { expect, test } from '@jest/globals'
import { wrapFunction } from '../src/parts/WrapCommand/WrapCommand.ts'

test('wrapFunction handles successful function execution', async (): Promise<void> => {
  const mockFunction = async (options: { repositoryName: string; repositoryOwner: string }): Promise<string> => {
    return `${options.repositoryOwner}/${options.repositoryName}`
  }

  const wrapped = wrapFunction(mockFunction)
  const result = await wrapped({
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.type).toBe('success')
  expect(result.data).toBe('test-owner/test-repo')
  expect(result.error).toBeUndefined()
})

test('wrapFunction handles function errors', async (): Promise<void> => {
  const mockFunction = async (): Promise<string> => {
    throw new Error('Something went wrong')
  }

  const wrapped = wrapFunction(mockFunction)
  const result = await wrapped({
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.type).toBe('error')
  expect(result.error).toBe('Something went wrong')
  expect(result.data).toBeUndefined()
})

test('wrapFunction passes through all options', async (): Promise<void> => {
  const mockFunction = async (options: {
    branch?: string
    githubToken?: string
    repositoryName: string
    repositoryOwner: string
  }): Promise<Record<string, any>> => {
    return { ...options }
  }

  const wrapped = wrapFunction(mockFunction)
  const result = await wrapped({
    branch: 'develop',
    githubToken: 'secret-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.type).toBe('success')
  expect(result.data).toEqual({
    branch: 'develop',
    githubToken: 'secret-token',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })
})

test('wrapFunction handles non-Error exceptions', async (): Promise<void> => {
  const mockFunction = async (): Promise<string> => {
    throw 'string error'
  }

  const wrapped = wrapFunction(mockFunction)
  const result = await wrapped({
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  })

  expect(result.type).toBe('error')
  expect(result.error).toBe('string error')
})
