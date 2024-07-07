const { mkdir, writeFile, readFile, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

/**
 *
 * @param {any[]} value
 * @param {string} repoName
 * @param {string} version
 * @returns
 */
const getNewValue = (value, repoName, version) => {
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

/**
 *
 * @param {string} releasedRepo
 * @param {string} tagName
 * @returns {string}
 */
const getCommitMessage = (releasedRepo, tagName) => {
  if (releasedRepo === 'renderer-process') {
    return `feature: update ${releasedRepo} to version ${tagName}`
  }
  if (
    releasedRepo.startsWith('language-basics') ||
    releasedRepo.startsWith('language-features')
  ) {
    return `feature: update ${releasedRepo} to version ${tagName}`
  }
  return `feature: update ${releasedRepo} extension to version ${tagName}`
}

/**
 * @param {import('probot').Context<"release">['octokit']} octokit
 * @param {any} pullRequestData
 */
const enableAutoSquash = async (octokit, pullRequestData) => {
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

/**
 * @param {import('probot').Context<"release">} context
 */
const updateBuiltinExtensions = async (context) => {
  const { payload, octokit } = context
  const tagName = payload.release.tag_name
  const owner = payload.repository.owner.login
  const baseBranch = 'main'
  const repo = 'lvce-editor'
  const releasedRepo = payload.repository.name
  if (releasedRepo === 'renderer-process') {
    return
  }
  const filesPath =
    'packages/build/src/parts/DownloadBuiltinExtensions/builtinExtensions.json'
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

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: mainBranchRef.data.object.sha,
  })
  console.log('created branch')

  await context.octokit.repos.createOrUpdateFileContents({
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

/**
 *
 * @param {any} oldPackageJson
 * @param {string} newVersion
 * @returns
 */
const getNewRendererWorkerPackageJson = (oldPackageJson, newVersion) => {
  oldPackageJson.dependencies['@lvce-editor/renderer-process'] =
    `^${newVersion}`
  return oldPackageJson
}

/**
 *
 * @param {any} oldPackageJson
 * @param {string} newVersion
 * @returns
 */
const getNewRenderWorkerPackageFiles = async (oldPackageJson, newVersion) => {
  const tmpFolder = join(tmpdir(), 'renderer-process-release')
  try {
    oldPackageJson.dependencies['@lvce-editor/renderer-process'] =
      `^${newVersion}`
    const oldPackageJsonStringified =
      JSON.stringify(oldPackageJson, null, 2) + '\n'
    await mkdir(tmpFolder, { recursive: true })
    await writeFile(join(tmpFolder, 'package.json'), oldPackageJsonStringified)
    const { execa } = await import('execa')
    await execa(`npm`, ['install'], {
      cwd: tmpFolder,
    })
    const newPackageLockJsonString = await readFile(
      join(tmpFolder, 'package-lock.json'),
      'utf8',
    )
    return {
      newPackageJsonString: oldPackageJsonStringified,
      newPackageLockJsonString,
    }
  } catch (error) {
    throw new Error(`Failed to update renderer-process: ${error}`)
  } finally {
    await rm(tmpFolder, {
      recursive: true,
      force: true,
    })
  }
}

/**
 * @param {import('probot').Context<"release">} context
 */
const updateRendererProcessVersion = async (context) => {
  const { payload, octokit } = context
  const tagName = payload.release.tag_name
  const owner = payload.repository.owner.login
  const releasedRepo = payload.repository.name
  if (releasedRepo !== 'renderer-process') {
    return
  }
  const packageJsonPath = 'packages/renderer-worker/package.json'
  const packageLockJsonPath = 'packages/renderer-worker/package-lock.json'
  const version = tagName.replace('v', '')

  const newBranch = `update-version/${releasedRepo}-${tagName}`
  const baseBranch = 'main'
  const repo = 'lvce-editor'

  const packageJsonRef = await context.octokit.rest.repos.getContent({
    owner,
    repo,
    path: packageJsonPath,
  })
  const packageLockJsonRef = await context.octokit.rest.repos.getContent({
    owner,
    repo,
    path: packageLockJsonPath,
  })

  if (
    !('content' in packageJsonRef.data) ||
    !('content' in packageLockJsonRef.data)
  ) {
    console.log('no content in files')
    return
  }

  const filesJsonBase64 = packageJsonRef.data.content
  const filesJsonDecoded = Buffer.from(filesJsonBase64, 'base64').toString()
  const filesJsonValue = JSON.parse(filesJsonDecoded)
  console.log({ filesJsonValue })
  const oldVersion =
    filesJsonValue.dependencies[`@lvce-editor/${releasedRepo}`].slice(1)

  console.log({ oldVersion })
  if (oldVersion === version) {
    console.info('same version')
    return
  }
  const { newPackageJsonString, newPackageLockJsonString } =
    await getNewRenderWorkerPackageFiles(filesJsonValue, version)

  const packageJsonBase64New =
    Buffer.from(newPackageJsonString).toString('base64')
  const packageLockJsonBase64New = Buffer.from(
    newPackageLockJsonString,
  ).toString('base64')

  const mainBranchRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  })

  const newBranchRef = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: mainBranchRef.data.object.sha,
  })
  console.log('created branch')

  /**
   * @type {'100644'}
   */
  const modeFile = '100644'
  /**
   * @type {'blob'}
   */
  const typeFile = 'blob'

  const commitableFiles = [
    {
      path: packageJsonPath,
      mode: modeFile,
      type: typeFile,
      content: packageJsonBase64New,
    },
    {
      path: packageLockJsonPath,
      mode: modeFile,
      type: typeFile,
      content: packageLockJsonBase64New,
    },
  ]

  const newTree = await context.octokit.rest.git.createTree({
    owner,
    repo,
    tree: commitableFiles,
    base_tree: newBranchRef.data.object.sha,
  })

  await octokit.rest.git.createCommit({
    owner,
    repo,
    message: getCommitMessage(releasedRepo, tagName),
    tree: newTree.data.sha,
    parents: [newBranchRef.data.object.sha],
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

/**
 * @param {import('probot').Context<"release">} context
 */
const handleReleaseReleased = async (context) => {
  await Promise.all([
    updateBuiltinExtensions(context),
    updateRendererProcessVersion(context),
  ])
}

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.on('release.released', handleReleaseReleased)
}
