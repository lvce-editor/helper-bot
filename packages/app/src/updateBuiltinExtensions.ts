import { Context } from 'probot'
import { getReleaseArchiveIntegrity } from './getReleaseArchiveIntegrity.ts'

const getNewValue = (value: readonly any[], repoName: string, version: string, assetName: string, sha256: string) => {
  return value.map((item) => {
    if (item.name === `builtin.${repoName}`) {
      const itemWithoutAssetName = { ...item }
      delete itemWithoutAssetName.assetName
      const defaultAssetName = `${repoName}-v${version}.tar.br`
      return {
        ...itemWithoutAssetName,
        version,
        ...(assetName === defaultAssetName ? {} : { assetName }),
        sha256,
      }
    }
    return item
  })
}

const shortCommitMessageRepos = ['renderer-process', 'editor-worker', 'text-search-worker', 'file-search-worker', 'virtual-dom', 'iframe-worker']

const shouldUseShortCommitMessage = (releasedRepo: string): boolean => {
  return shortCommitMessageRepos.includes(releasedRepo)
}

const getCommitMessage = (releasedRepo: string, tagName: string): string => {
  if (shouldUseShortCommitMessage(releasedRepo)) {
    return `feature: update ${releasedRepo} to version ${tagName}`
  }
  if (releasedRepo.startsWith('language-basics') || releasedRepo.startsWith('language-features')) {
    return `feature: update ${releasedRepo} to version ${tagName}`
  }
  return `feature: update ${releasedRepo} extension to version ${tagName}`
}

const enableAutoSquash = async (octokit: Context<'release'>['octokit'], pullRequestData: any) => {
  await octokit.graphql(
    `mutation MyMutation {
  enablePullRequestAutoMerge(input: { pullRequestId: "${pullRequestData.data.node_id}", mergeMethod: SQUASH }) {
    clientMutationId
  }
}
`,
    {},
  )
}

export const updateBuiltinExtensions = async (context: Context<'release'>) => {
  const { payload, octokit } = context
  const tagName = payload.release.tag_name
  const owner = payload.repository.owner.login
  const baseBranch = 'main'
  const repo = 'lvce-editor'
  const releasedRepo = payload.repository.name
  if (releasedRepo === 'renderer-process') {
    return
  }
  const filesPath = 'packages/build/src/parts/DownloadBuiltinExtensions/builtinExtensions.json'
  const version = tagName.replace('v', '')
  console.log(`release was released ${payload.repository.name}@${version}`)

  const newBranch = `update-version/${releasedRepo}-${tagName}`

  const filesJson = await context.octokit.rest.repos.getContent({
    owner,
    repo,
    path: filesPath,
  })

  if (!('content' in filesJson.data)) {
    console.log('no content in files')
    return
  }
  const filesJsonBase64 = filesJson.data.content
  const filesJsonDecoded = Buffer.from(filesJsonBase64, 'base64').toString()
  const filesJsonValue = JSON.parse(filesJsonDecoded)
  const builtinExtension = filesJsonValue.find((item: any) => item.name === `builtin.${releasedRepo}`)
  if (!builtinExtension) {
    console.log('released repository is not a builtin extension')
    return
  }
  const { assetName, sha256 } = await getReleaseArchiveIntegrity(payload)
  const filesJsonValueNew = getNewValue(filesJsonValue, releasedRepo, version, assetName, sha256)
  const filesJsonStringNew = JSON.stringify(filesJsonValueNew, null, 2) + '\n'
  if (filesJsonDecoded === filesJsonStringNew) {
    console.log('no update necessary')
    return
  }
  const filesJsonBase64New = Buffer.from(filesJsonStringNew).toString('base64')

  const mainBranchRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  })

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: mainBranchRef.data.object.sha,
  })
  console.log('created branch')

  await context.octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filesPath,
    message: getCommitMessage(releasedRepo, tagName),
    content: filesJsonBase64New,
    branch: newBranch,
    sha: filesJson.data.sha,
  })
  const pullRequestData = await octokit.rest.pulls.create({
    owner,
    repo,
    head: newBranch,
    base: baseBranch,
    title: `feature: update ${releasedRepo} to version ${tagName}`,
  })
  await enableAutoSquash(octokit, pullRequestData)
}
