export const githubFetch = async (
  url: string,
  token: string,
  fetchFn: typeof globalThis.fetch,
  options: RequestInit = {},
): Promise<{ data: any; status: number }> => {
  const response = await fetchFn(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })

  let data: any = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  return {
    data,
    status: response.status,
  }
}
