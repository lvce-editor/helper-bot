export const createMockFetch = (
  versions: Array<{ version: string; lts: string | false }>,
): typeof globalThis.fetch => {
  return async () => {
    return {
      json: async () => versions,
    } as Response
  }
}
