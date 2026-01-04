import type { Octokit } from '@octokit/rest'

export const getLatestRelease = async (octokit: Octokit, owner: string, repo: string): Promise<{ tag_name: string; target_commitish: string } | null> => {
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
      owner,
      repo,
    })

    return {
      tag_name: response.data.tag_name,
      target_commitish: response.data.target_commitish,
    }
  } catch (error: any) {
    if (error && error.status === 404) {
      // No releases found, try to get latest tag instead
      try {
        const tagsResponse = await octokit.request('GET /repos/{owner}/{repo}/tags', {
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
          owner,
          per_page: 1,
          repo,
        })

        if (!Array.isArray(tagsResponse.data) || tagsResponse.data.length === 0) {
          return null
        }

        const latestTag = tagsResponse.data[0]
        // Get the commit SHA for the tag
        const tagRefResponse = await octokit.request('GET /repos/{owner}/{repo}/git/refs/tags/{ref}', {
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
          owner,
          ref: latestTag.name,
          repo,
        })

        return {
          tag_name: latestTag.name,
          target_commitish: tagRefResponse.data.object.sha,
        }
      } catch {
        return null
      }
    }
    return null
  }
}
