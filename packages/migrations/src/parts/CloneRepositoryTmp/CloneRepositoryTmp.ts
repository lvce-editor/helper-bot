import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'

export interface CloneRepositoryTmpResult {
  path: string
  [Symbol.asyncDispose]: () => Promise<void>
}

export const cloneRepositoryTmp = async (
  owner: string,
  repo: string,
): Promise<CloneRepositoryTmpResult> => {
  const tempDir = await mkdtemp(join(tmpdir(), `migration-${owner}-${repo}-`))

  await execa('git', ['clone', `https://github.com/${owner}/${repo}.git`, tempDir])

  return {
    path: tempDir,
    async [Symbol.asyncDispose]() {
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}
