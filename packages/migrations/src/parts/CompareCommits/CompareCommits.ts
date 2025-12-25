import { githubFetch } from '../GithubFetch/GithubFetch.ts'

export const compareCommits = async (
  fetchFn: typeof globalThis.fetch,
  githubToken: string,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<{ hasCommits: boolean; commitCount: number }> => {
  try {
    const comparison = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`, githubToken, fetchFn)

    if (comparison.status !== 200) {
      // If comparison fails, assume there are commits
      return {
        hasCommits: true,
        commitCount: 0,
      }
    }

    // If status is 'identical', there are no commits
    // If status is 'ahead' or 'diverged', there are commits
    const hasCommits = comparison.data.status !== 'identical' && comparison.data.ahead_by > 0
    return {
      hasCommits,
      commitCount: comparison.data.ahead_by || 0,
    }
  } catch (error: any) {
    // If comparison fails (e.g., base doesn't exist), assume there are commits
    return {
      hasCommits: true,
      commitCount: 0,
    }
  }
}
