export const createMockFetch = (versions: ReadonlyArray<{ version: string; lts: string | false }>): typeof globalThis.fetch => {
  return async () => {
    return {
      json: async () => versions,
    } as Response
  }
}
