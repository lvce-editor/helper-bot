import { test, expect, jest } from '@jest/globals'
import { Context } from 'probot'

const mockExeca = jest.fn<any>()
const mockCloneRepo = jest.fn<any>()
const mockCommitAndPush = jest.fn<any>()

jest.unstable_mockModule('execa', () => ({
  execa: mockExeca,
}))

jest.unstable_mockModule('../src/cloneRepo', () => ({
  cloneRepo: mockCloneRepo,
}))

jest.unstable_mockModule('../src/commitAndPush', () => ({
  commitAndPush: mockCommitAndPush,
}))

test('handleCheckRun should not run if check run is not failed', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      check_run: {
        conclusion: 'success',
        head_sha: 'test-sha',
      },
      repository: {
        owner: {
          login: 'owner',
        },
        name: 'repo',
      },
    },
    octokit: {
      rest: {
        checks: {
          listForRef: jest.fn<any>(),
        },
        repos: {
          getCommit: jest.fn<any>(),
        },
      },
    },
  } as any

  await handleCheckRun(context)
  expect(context.octokit.rest.checks.listForRef).not.toHaveBeenCalled()
})

test('handleCheckRun should not run if no PR found', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      check_run: {
        conclusion: 'failure',
        head_sha: 'test-sha',
      },
      repository: {
        owner: {
          login: 'owner',
        },
        name: 'repo',
      },
    },
    octokit: {
      rest: {
        checks: {
          listForRef: jest.fn<any>().mockResolvedValue({
            data: {
              check_runs: [
                {
                  pull_requests: [],
                },
              ],
            },
          }),
        },
        repos: {
          getCommit: jest.fn<any>(),
        },
      },
    },
  } as any

  await handleCheckRun(context)
  expect(context.octokit.rest.repos.getCommit).not.toHaveBeenCalled()
})

test('handleCheckRun should not run if no committer found', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      check_run: {
        conclusion: 'failure',
        head_sha: 'test-sha',
      },
      repository: {
        owner: {
          login: 'owner',
        },
        name: 'repo',
      },
    },
    octokit: {
      rest: {
        checks: {
          listForRef: jest.fn<any>().mockResolvedValue({
            data: {
              check_runs: [
                {
                  pull_requests: [
                    {
                      number: 1,
                    },
                  ],
                },
              ],
            },
          }),
        },
        repos: {
          getCommit: jest.fn<any>().mockResolvedValue({
            data: {
              commit: {
                author: null,
              },
            },
          }),
        },
      },
    },
  } as any

  await handleCheckRun(context)
})

test('handleCheckRun should not run if committer is not authorized', async () => {
  process.env.AUTHORIZED_COMMITTER = 'authorized@example.com'
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      check_run: {
        conclusion: 'failure',
        head_sha: 'test-sha',
      },
      repository: {
        owner: {
          login: 'owner',
        },
        name: 'repo',
      },
    },
    octokit: {
      rest: {
        checks: {
          listForRef: jest.fn<any>().mockResolvedValue({
            data: {
              check_runs: [
                {
                  pull_requests: [
                    {
                      number: 1,
                    },
                  ],
                },
              ],
            },
          }),
        },
        repos: {
          getCommit: jest.fn<any>().mockResolvedValue({
            data: {
              commit: {
                author: {
                  email: 'unauthorized@example.com',
                },
              },
            },
          }),
        },
      },
    },
  } as any

  await handleCheckRun(context)
})

test('handleCheckRun should run if all conditions are met', async () => {
  process.env.AUTHORIZED_COMMITTER = 'authorized@example.com'
  mockExeca.mockImplementation(async () => ({ stdout: '', stderr: '' }))
  mockCloneRepo.mockResolvedValue()
  mockCommitAndPush.mockResolvedValue()
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      check_run: {
        conclusion: 'failure',
        head_sha: 'test-sha',
      },
      repository: {
        owner: {
          login: 'owner',
        },
        name: 'repo',
      },
    },
    octokit: {
      rest: {
        checks: {
          listForRef: jest.fn<any>().mockResolvedValue({
            data: {
              check_runs: [
                {
                  pull_requests: [
                    {
                      number: 1,
                    },
                  ],
                },
              ],
            },
          }),
        },
        repos: {
          getCommit: jest.fn<any>().mockResolvedValue({
            data: {
              commit: {
                author: {
                  email: 'authorized@example.com',
                },
              },
            },
          }),
        },
        pulls: {
          get: jest.fn<any>().mockResolvedValue({
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
    },
  } as any

  await handleCheckRun(context)
  expect(context.octokit.rest.pulls.get).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    pull_number: 1,
  })
  expect(mockCloneRepo).toHaveBeenCalled()
  expect(mockExeca).toHaveBeenCalledTimes(3)
  expect(mockCommitAndPush).toHaveBeenCalled()
}, 10000)
