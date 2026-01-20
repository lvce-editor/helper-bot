export const createMockNpmFetch = (packageVersions: Record<string, string>): typeof globalThis.fetch => {
  return async (url: string | URL | Request) => {
    const urlStr = url.toString()

    for (const [packageName, version] of Object.entries(packageVersions)) {
      const expectedUrl = `https://registry.npmjs.org/${packageName}/latest`
      if (urlStr === expectedUrl) {
        return {
          json: async () => ({ version }),
          ok: true,
          status: 200,
          statusText: 'OK',
        } as Response
      }
    }

    throw new Error(`Unexpected fetch call: ${urlStr}`)
  }
}
