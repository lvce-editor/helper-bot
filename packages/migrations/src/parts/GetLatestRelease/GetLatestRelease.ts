import { githubFetch } from '../GithubFetch/GithubFetch.ts'

export const getLatestRelease = async (
  fetchFn: typeof globalThis.fetch,
  githubToken: string,
  owner: string,
  repo: string,
): Promise<{ tag_name: string; target_commitish: string } | null> => {
  try {
    const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, githubToken, fetchFn)

    if (response.status === 404) {
      // No releases found, try to get latest tag instead
      const tagsResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=1`, githubToken, fetchFn)

      if (tagsResponse.status !== 200 || !Array.isArray(tagsResponse.data) || tagsResponse.data.length === 0) {
        return null
      }

      const latestTag = tagsResponse.data[0]
      // Get the commit SHA for the tag
      const tagRefResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/tags/${latestTag.name}`, githubToken, fetchFn)

      if (tagRefResponse.status !== 200) {
        return null
      }

      return {
        tag_name: latestTag.name,
        target_commitish: tagRefResponse.data.object.sha,
      }
    }

    if (response.status !== 200) {
      return null
    }

    return {
      tag_name: response.data.tag_name,
      target_commitish: response.data.target_commitish,
    }
  } catch (error) {
    return null
  }
}
