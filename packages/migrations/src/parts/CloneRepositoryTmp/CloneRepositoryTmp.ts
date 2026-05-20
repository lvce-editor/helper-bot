import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ExecFunction } from '../Types/Types.ts'

export interface CloneRepositoryTmpResult {
  readonly [Symbol.asyncDispose]: () => Promise<void>
  readonly uri: string
}

const getRepositoryCloneUrl = (owner: string, repo: string, githubToken?: string): string => {
  if (!githubToken) {
    return `https://github.com/${owner}/${repo}.git`
  }
  return `https://x-access-token:${encodeURIComponent(githubToken)}@github.com/${owner}/${repo}.git`
}

export const cloneRepositoryTmp = async (exec: ExecFunction, owner: string, repo: string, githubToken?: string): Promise<CloneRepositoryTmpResult> => {
  const tempDir = await mkdtemp(join(tmpdir(), `migration-${owner}-${repo}-${Date.now()}`))

  await exec('git', ['clone', getRepositoryCloneUrl(owner, repo, githubToken), tempDir])

  const clonedUri = pathToFileURL(tempDir).href + '/'
  return {
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(tempDir, { force: true, recursive: true })
    },
    uri: clonedUri,
  }
}
