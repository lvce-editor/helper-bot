import { expect, test, jest } from '@jest/globals'

const encode = (s: string): string => Buffer.from(s).toString('base64')

test('returns undefined when workflows directory is missing', async () => {
  const octokit = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest.fn().mockRejectedValueOnce({ status: 404 }),
      },
    },
  }

  const { updateGithubActions } = await import('../src/updateGithubActions.js')
  const result = await updateGithubActions({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    osVersions: { ubuntu: '24.04' },
  })

  expect(result).toBeUndefined()
})

test('returns 0 changes when no files require update', async () => {
  const workflowsListing = {
    data: [
      {
        type: 'file',
        name: 'ci.yml',
        path: '.github/workflows/ci.yml',
      },
    ],
  }

  const fileContent = {
    data: {
      content: encode('runs-on: ubuntu-24.04\n'),
      sha: 'sha-ci',
    },
  }

  const octokit = {
    rest: {
      repos: {
        // First call: list workflows; Second: get file
        // @ts-ignore
        getContent: jest
          .fn()
          .mockResolvedValueOnce(workflowsListing)
          .mockResolvedValueOnce(fileContent),
      },
    },
  }

  const { updateGithubActions } = await import('../src/updateGithubActions.js')
  const result = await updateGithubActions({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    osVersions: { ubuntu: '24.04' },
  })

  expect(result).toEqual({ changedFiles: 0 })
})

test('updates workflow files and opens PR', async () => {
  const workflowsListing = {
    data: [
      {
        type: 'file',
        name: 'ci.yml',
        path: '.github/workflows/ci.yml',
      },
      {
        type: 'file',
        name: 'release.yaml',
        path: '.github/workflows/release.yaml',
      },
    ],
  }

  const ciContent = {
    data: {
      content: encode('jobs:\n  build:\n    runs-on: ubuntu-22.04\n'),
      sha: 'sha-ci',
    },
  }
  const releaseContent = {
    data: {
      content: encode('jobs:\n  release:\n    runs-on: windows-2022\n'),
      sha: 'sha-release',
    },
  }

  const getRefResp = { data: { object: { sha: 'base-sha' } } }

  const octokit = {
    rest: {
      repos: {
        // @ts-ignore
        getContent: jest
          .fn()
          .mockResolvedValueOnce(workflowsListing)
          .mockResolvedValueOnce(ciContent)
          .mockResolvedValueOnce(releaseContent),
      },
      git: {
        // @ts-ignore
        getRef: jest.fn().mockResolvedValue(getRefResp),
        // @ts-ignore
        createRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        // @ts-ignore
        create: jest.fn().mockResolvedValue({ data: { number: 1 } }),
      },
    },
    repos: {
      // @ts-ignore
      createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
    },
  }

  const { updateGithubActions } = await import('../src/updateGithubActions.js')
  const result = await updateGithubActions({
    // @ts-ignore
    octokit,
    owner: 'org',
    repo: 'repo',
    osVersions: { ubuntu: '24.04', windows: '2025' },
  })

  expect(result && result.changedFiles).toBe(2)
  expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    ref: 'heads/main',
  })
  expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    ref: expect.stringMatching(/^refs\/heads\/update-gh-actions-/),
    sha: 'base-sha',
  })
  expect(octokit.repos.createOrUpdateFileContents).toHaveBeenCalledTimes(2)
  expect(octokit.rest.pulls.create).toHaveBeenCalledWith({
    owner: 'org',
    repo: 'repo',
    head: expect.stringMatching(/^update-gh-actions-/),
    base: 'main',
    title: 'ci: update CI OS versions',
  })
})
