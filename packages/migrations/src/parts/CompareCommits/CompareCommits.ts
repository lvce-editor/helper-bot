import type { Octokit } from '@octokit/rest'

export const compareCommits = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<{ hasCommits: boolean; commitCount: number }> => {
  try {
    const comparison = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
      base,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      head,
      owner,
      repo,
    })

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
