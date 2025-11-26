import { execa } from 'execa'

export const cloneRepo = async (
  owner: string,
  repo: string,
  tmpFolder: string,
) => {
  await execa('git', [
    'clone',
    `https://github.com/${owner}/${repo}.git`,
    tmpFolder,
  ])
}
