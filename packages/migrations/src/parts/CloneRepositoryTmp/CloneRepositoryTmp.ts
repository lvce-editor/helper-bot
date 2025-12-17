import { execa } from 'execa'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface CloneRepositoryTmpResult {
  [Symbol.asyncDispose]: () => Promise<void>
  path: string
}

export const cloneRepositoryTmp = async (
  owner: string,
  repo: string,
): Promise<CloneRepositoryTmpResult> => {
  const tempDir = await mkdtemp(join(tmpdir(), `migration-${owner}-${repo}-`))

  await execa('git', [
    'clone',
    `https://github.com/${owner}/${repo}.git`,
    tempDir,
  ])

  return {
    path: tempDir,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(tempDir, { force: true, recursive: true })
    },
  }
}
