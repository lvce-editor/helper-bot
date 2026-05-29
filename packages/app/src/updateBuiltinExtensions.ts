import { Context } from 'probot'

const getNewValue = (value: readonly any[], repoName: string, version: string) => {
  return value.map((item) => {
    if (item.name === `builtin.${repoName}`) {
      return {
        ...item,
        version,
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

const isReferenceAlreadyExistsError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 422
}

const findOpenPullRequest = async (octokit: Context<'release'>['octokit'], owner: string, repo: string, branch: string): Promise<any | undefined> => {
  const pullRequests = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: 'open',
  })
  return pullRequests.data[0]
}

const createPullRequest = async (
  octokit: Context<'release'>['octokit'],
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
): Promise<any> => {
  try {
    return await octokit.rest.pulls.create({
      owner,
      repo,
      head,
      base,
      title,
    })
  } catch (error) {
    if (!isReferenceAlreadyExistsError(error)) {
      throw error
    }
    const existingPullRequest = await findOpenPullRequest(octokit, owner, repo, head)
    if (!existingPullRequest) {
      throw error
    }
    return {
      data: existingPullRequest,
    }
  }
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
  const filesJsonValueNew = getNewValue(filesJsonValue, releasedRepo, version)
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

  let branchAlreadyExists = false
  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: mainBranchRef.data.object.sha,
    })
  } catch (error) {
    if (!isReferenceAlreadyExistsError(error)) {
      throw error
    }
    branchAlreadyExists = true
  }
  console.log('created branch')

  if (branchAlreadyExists) {
    const existingPullRequest = await findOpenPullRequest(octokit, owner, repo, newBranch)
    if (existingPullRequest) {
      await enableAutoSquash(octokit, {
        data: existingPullRequest,
      })
      return
    }
  }

  let fileSha = filesJson.data.sha
  let shouldUpdateFile = true
  if (branchAlreadyExists) {
    const branchFilesJson = await context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: filesPath,
      ref: newBranch,
    })
    if (!('content' in branchFilesJson.data)) {
      console.log('no content in branch files')
      return
    }
    const branchFilesJsonDecoded = Buffer.from(branchFilesJson.data.content, 'base64').toString()
    if (branchFilesJsonDecoded === filesJsonStringNew) {
      console.log('no update necessary')
      shouldUpdateFile = false
    } else {
      fileSha = branchFilesJson.data.sha
    }
  }

  if (shouldUpdateFile) {
    await context.octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filesPath,
      message: getCommitMessage(releasedRepo, tagName),
      content: filesJsonBase64New,
      branch: newBranch,
      sha: fileSha,
    })
  }

  const pullRequestData = await createPullRequest(octokit, owner, repo, newBranch, baseBranch, `feature: update ${releasedRepo} to version ${tagName}`)
  await enableAutoSquash(octokit, pullRequestData)
}
