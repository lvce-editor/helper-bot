export interface FunctionOptions {
  [key: string]: any
  readonly githubToken: string
  readonly owner: string
  readonly repo: string
}

export const wrapFunction = <T extends FunctionOptions, R>(
  fn: (options: T) => Promise<R>,
): ((options: T) => Promise<{ data?: R; error?: string; type: string }>) => {
  const wrapped = async (options: T): Promise<{ data?: R; error?: string; type: string }> => {
    try {
      const result = await fn(options)
      return {
        data: result,
        type: 'success',
      }
    } catch (error) {
      let errorMessage: string
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (error && typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error)
        } catch {
          errorMessage = 'Unknown error'
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (typeof error === 'number' || typeof error === 'boolean') {
        errorMessage = String(error)
      } else {
        errorMessage = 'Unknown error'
      }
      return {
        error: errorMessage,
        type: 'error',
      }
    }
  }
  return wrapped
}
