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

  expect(result).toEqual({
    data: 'test-owner/test-repo',
    type: 'success',
  })
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

  expect(result).toEqual({
    error: 'Something went wrong',
    type: 'error',
  })
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

  expect(result).toEqual({
    data: {
      branch: 'develop',
      githubToken: 'secret-token',
      repositoryName: 'test-repo',
      repositoryOwner: 'test-owner',
    },
    type: 'success',
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

  expect(result).toEqual({
    error: 'string error',
    type: 'error',
  })
})
