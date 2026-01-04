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
      head,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      owner,
      repo,
    })

    // If status is 'identical', there are no commits
    // If status is 'ahead' or 'diverged', there are commits
    const hasCommits = comparison.data.status !== 'identical' && comparison.data.ahead_by > 0
    return {
      commitCount: comparison.data.ahead_by || 0,
      hasCommits,
    }
  } catch {
    // If comparison fails (e.g., base doesn't exist), assume there are commits
    return {
      commitCount: 0,
      hasCommits: true,
    }
  }
}
