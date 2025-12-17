import { expect, jest, test } from '@jest/globals'

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

test('handleCheckRun should not run if check suite is not failed', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      check_suite: {
        conclusion: 'success',
        head_sha: 'test-sha',
        pull_requests: [],
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
        repos: {
          getCommit: jest.fn<any>(),
        },
      },
    },
  } as any

  await handleCheckRun(context, 'authorized@example.com')
  expect(context.octokit.rest.repos.getCommit).not.toHaveBeenCalled()
})

test('handleCheckRun should not run if no PR found', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      check_suite: {
        conclusion: 'failure',
        head_sha: 'test-sha',
        pull_requests: [],
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
        repos: {
          getCommit: jest.fn<any>(),
        },
      },
    },
  } as any

  await handleCheckRun(context, 'authorized@example.com')
  expect(context.octokit.rest.repos.getCommit).not.toHaveBeenCalled()
})

test('handleCheckRun should not run if no committer found', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      sender: {
        login: '',
      },
      check_suite: {
        conclusion: 'failure',
        head_sha: 'test-sha',
        pull_requests: [
          {
            number: 1,
          },
        ],
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

  await handleCheckRun(context, 'authorized@example.com')
})

test('handleCheckRun should not run if committer is not authorized', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      sender: {
        login: 'not-authorized@example.com',
      },
      check_suite: {
        conclusion: 'failure',
        head_sha: 'test-sha',
        pull_requests: [
          {
            number: 1,
          },
        ],
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

  await handleCheckRun(context, 'authorized@example.com')
})

test('handleCheckRun should not run if PR is from a fork', async () => {
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      sender: {
        login: 'authorized@example.com',
      },
      check_suite: {
        conclusion: 'failure',
        head_sha: 'test-sha',
        pull_requests: [
          {
            number: 1,
          },
        ],
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
                repo: {
                  owner: {
                    login: 'fork-owner',
                  },
                  full_name: 'fork-owner/repo',
                },
              },
            },
          }),
        },
      },
    },
  } as any

  await handleCheckRun(context, 'authorized@example.com')
  expect(context.octokit.rest.pulls.get).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    pull_number: 1,
  })
  expect(mockCloneRepo).not.toHaveBeenCalled()
})

test('handleCheckRun should run if all conditions are met', async () => {
  mockExeca.mockImplementation(async () => ({ stdout: '', stderr: '' }))
  mockCloneRepo.mockImplementation(async (owner: string, repo: string, tmpFolder: string) => {})
  mockCommitAndPush.mockImplementation(async (tmpFolder: string, branchName: string, octokit: any, owner: string, repo: string) => {})
  const { handleCheckRun } = await import('../src/handleCheckRun')
  const context = {
    payload: {
      sender: {
        login: 'authorized@example.com',
      },
      check_suite: {
        conclusion: 'failure',
        head_sha: 'test-sha',
        pull_requests: [
          {
            number: 1,
          },
        ],
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
                  owner: {
                    login: 'owner',
                  },
                  full_name: 'owner/repo',
                  clone_url: 'https://github.com/owner/repo.git',
                },
              },
            },
          }),
        },
      },
    },
  } as any

  await handleCheckRun(context, 'authorized@example.com')
  expect(context.octokit.rest.pulls.get).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    pull_number: 1,
  })
  expect(mockCloneRepo).toHaveBeenCalledWith('owner', 'repo', expect.any(String))
  expect(mockExeca).toHaveBeenCalledTimes(3)
  expect(mockCommitAndPush).toHaveBeenCalledWith(expect.any(String), 'feature-branch', context.octokit, 'owner', 'repo', {
    baseBranch: 'feature-branch',
    commitMessage: 'style: fix eslint errors',
    createNewBranch: false,
  })
}, 10000)
