import { test, expect, jest } from '@jest/globals'
import { autoFixCi } from '../src/autoFixCi.js'
import { execa } from 'execa'
import { cloneRepo } from '../src/cloneRepo.js'
import { commitAndPush } from '../src/commitAndPush.js'

jest.mock('execa')
jest.mock('../src/cloneRepo.js')
jest.mock('../src/commitAndPush.js')

const mockExeca = execa as jest.MockedFunction<typeof execa>
const mockCloneRepo = cloneRepo as jest.MockedFunction<typeof cloneRepo>
const mockCommitAndPush = commitAndPush as jest.MockedFunction<
  typeof commitAndPush
>

test('processes items in queue', async () => {
  mockExeca.mockImplementation(async () => ({ stdout: '', stderr: '' }))
  mockCloneRepo.mockImplementation(
    async (owner: string, repo: string, tmpFolder: string) => {},
  )
  mockCommitAndPush.mockImplementation(
    async (
      tmpFolder: string,
      branchName: string,
      octokit: any,
      owner: string,
      repo: string,
    ) => true,
  )

  const mockOctokit = {
    rest: {
      pulls: {
        get: jest.fn().mockResolvedValue({
          data: {
            head: {
              ref: 'feature-branch',
              repo: {
                clone_url: 'https://github.com/owner/repo.git',
              },
            },
          },
        }),
      },
    },
  }

  await autoFixCi(mockOctokit as any, 'owner', 'repo', 1)

  expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    pull_number: 1,
  })
  expect(mockCloneRepo).toHaveBeenCalledWith(
    'owner',
    'repo',
    expect.any(String),
  )
  expect(mockExeca).toHaveBeenCalledTimes(3)
  expect(mockCommitAndPush).toHaveBeenCalled()
})
