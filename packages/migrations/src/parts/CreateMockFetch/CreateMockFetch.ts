export const createMockFetch = (
  versions: Array<{ version: string; lts: string | false }>,
) => {
  return async () => {
    return {
      json: async () => versions,
    } as Response
  }
}
