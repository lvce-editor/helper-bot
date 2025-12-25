import { githubFetch } from '../GithubFetch/GithubFetch.ts'

export const getLatestCommitOnBranch = async (
  fetchFn: typeof globalThis.fetch,
  githubToken: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> => {
  const branchRefResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, githubToken, fetchFn)

  if (branchRefResponse.status !== 200) {
    throw new Error(`Failed to get branch ref: ${branchRefResponse.status}`)
  }

  return branchRefResponse.data.object.sha
}
