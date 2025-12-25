import type { Octokit } from '@octokit/rest'

export const getLatestCommitOnBranch = async (octokit: Octokit, owner: string, repo: string, branch: string): Promise<string> => {
  const branchRefResponse = await octokit.request('GET /repos/{owner}/{repo}/git/refs/heads/{ref}', {
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
    owner,
    ref: branch,
    repo,
  })

  return branchRefResponse.data.object.sha
}
