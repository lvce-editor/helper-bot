import type { Octokit } from '@octokit/rest'
import { Octokit as OctokitConstructor } from '@octokit/rest'

export interface CreateTagRefOptions {
  readonly githubToken: string
  readonly owner: string
  readonly repo: string
  readonly sha: string
  readonly tag: string
}

export interface CreateTagRefResult {
  readonly message: string
  readonly status: 'created' | 'skipped'
}

const isReferenceAlreadyExistsError = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 422 &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('reference already exists')
  )
}

export const createTagRef = async (options: Readonly<CreateTagRefOptions>): Promise<CreateTagRefResult> => {
  const octokit: Octokit = new OctokitConstructor({
    auth: options.githubToken,
  })
  try {
    await octokit.rest.git.createRef({
      owner: options.owner,
      ref: `refs/tags/${options.tag}`,
      repo: options.repo,
      sha: options.sha,
    })
    return {
      message: `Created tag ${options.tag}`,
      status: 'created',
    }
  } catch (error) {
    if (isReferenceAlreadyExistsError(error)) {
      return {
        message: `Tag ${options.tag} already exists`,
        status: 'skipped',
      }
    }
    throw error
  }
}
