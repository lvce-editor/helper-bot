/* eslint-disable @typescript-eslint/no-base-to-string */
export const createMockNpmFetch = (
  packageVersions: Readonly<Record<string, string>>,
  options?: Readonly<{
    errorStatus?: number
    errorStatusText?: string
    throwError?: string
  }>,
): typeof globalThis.fetch => {
  return async (url: string | Readonly<URL> | Readonly<Request>) => {
    const urlStr = url.toString()

    if (urlStr.includes('registry.npmjs.org')) {
      if (options?.throwError) {
        throw new Error(options.throwError)
      }

      if (options?.errorStatus !== undefined) {
        return {
          json: async () => ({}),
          ok: false,
          status: options.errorStatus,
          statusText: options.errorStatusText || 'Error',
        } as Response
      }

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
    }

    throw new Error(`Unexpected fetch call: ${urlStr}`)
  }
}
