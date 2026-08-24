import { createHash } from 'node:crypto'
import type { Context } from 'probot'

export interface ReleaseArchiveIntegrity {
  assetName: string
  sha256: string
}

export const getReleaseArchiveIntegrity = async (payload: Context<'release'>['payload']): Promise<ReleaseArchiveIntegrity> => {
  const repositoryName = payload.repository.name
  const version = payload.release.tag_name.replace(/^v/, '')
  const defaultArchiveName = `${repositoryName}-v${version}.tar.br`
  const archiveAssets = payload.release.assets.filter((item) => item.name.endsWith('.tar.br'))
  const asset = archiveAssets.find((item) => item.name === defaultArchiveName) || (archiveAssets.length === 1 ? archiveAssets[0] : undefined)
  if (!asset) {
    throw new Error(`Release ${payload.release.tag_name} of ${repositoryName} must have exactly one .tar.br asset`)
  }

  const response = await fetch(asset.browser_download_url)
  if (!response.ok) {
    throw new Error(`Failed to download ${asset.browser_download_url}: ${response.status} ${response.statusText}`)
  }
  const contents = Buffer.from(await response.arrayBuffer())
  return {
    assetName: asset.name,
    sha256: createHash('sha256').update(contents).digest('hex'),
  }
}
