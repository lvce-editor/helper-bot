const { mkdir, writeFile, readFile, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const dependencies = [
  {
    fromRepo: 'renderer-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'virtual-dom',
    toRepo: 'renderer-process',
    toFolder: '',
  },
  {
    fromRepo: 'network-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
]

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
 * @param {string} dependencyName
 * @param {string} newVersion
 * @returns
 */
const getNewPackageFiles = async (
  oldPackageJson,
  dependencyName,
  newVersion,
) => {
  const tmpFolder = join(tmpdir(), `update-dependencies-${dependencyName}-tmp`)
  try {
    oldPackageJson.dependencies[`@lvce-editor/${dependencyName}`] =
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
    throw new Error(`Failed to update dependencies: ${error}`)
  } finally {
    await rm(tmpFolder, {
      recursive: true,
      force: true,
    })
  }
}

/**
 *
 * @param {{baseBranch:string, newBranch:string, octokit:import('probot').Context<"release">['octokit'], owner:string, repo:string, commitableFiles:any[], commitMessage:string, pullRequestTitle:string }} param0
 */
const createPullRequest = async ({
  baseBranch,
  newBranch,
  octokit,
  owner,
  repo,
  commitableFiles,
  commitMessage,
  pullRequestTitle,
}) => {
  const mainBranchRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  })

  console.log({ mainBranchRef })

  const latestCommit = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: mainBranchRef.data.object.sha,
  })

  console.log({ latestCommit })

  const startingCommitSha = latestCommit.data.sha

  console.log('created branch')

  const newTree = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: commitableFiles,
    base_tree: startingCommitSha,
  })

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.data.sha,
    parents: [startingCommitSha],
  })

  const newBranchRef = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: commit.data.sha,
  })

  console.log({ newBranchRef })
  const pullRequestData = await octokit.rest.pulls.create({
    owner,
    repo,
    head: newBranch,
    base: baseBranch,
    title: pullRequestTitle,
  })
  return pullRequestData
}

/**
 *
 * @param {string} parentFolder
 * @param {string} childPath
 * @returns
 */
const quickJoin = (parentFolder, childPath) => {
  if (!parentFolder) {
    return childPath
  }
  return parentFolder + '/' + childPath
}

/**
 * @param {import('probot').Context<"release">} context
 * @param {any} config
 */
const updateDependencies = async (context, config) => {
  const { payload, octokit } = context
  const tagName = payload.release.tag_name
  const owner = payload.repository.owner.login
  const releasedRepo = payload.repository.name
  if (releasedRepo !== config.fromRepo) {
    return
  }
  const packageJsonPath = quickJoin(config.toFolder, 'package.json')
  const packageLockJsonPath = quickJoin(config.toFolder, 'package-lock.json')
  const version = tagName.replace('v', '')

  const newBranch = `update-version/${releasedRepo}-${tagName}`
  const baseBranch = 'main'
  const repo = config.toRepo

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
  const dependencyName = `@lvce-editor/${releasedRepo}`
  const oldDependency =
    filesJsonValue.dependencies[dependencyName] ||
    filesJsonValue.optionalDependencies[dependencyName]
  if (!oldDependency) {
    throw new Error(
      `dependency ${dependencyName} not found in ${packageJsonPath}`,
    )
  }
  const oldVersion = oldDependency.slice(1)

  console.log({ oldVersion })
  if (oldVersion === version) {
    console.info('same version')
    return
  }
  const { newPackageJsonString, newPackageLockJsonString } =
    await getNewPackageFiles(filesJsonValue, config.fromRepo, version)

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
      content: newPackageJsonString,
    },
    {
      path: packageLockJsonPath,
      mode: modeFile,
      type: typeFile,
      content: newPackageLockJsonString,
    },
  ]

  const pullRequestData = await createPullRequest({
    octokit,
    baseBranch,
    newBranch,
    commitableFiles,
    commitMessage: getCommitMessage(releasedRepo, tagName),
    owner,
    pullRequestTitle: `feature: update ${releasedRepo} to version ${tagName}`,
    repo,
  })
  await enableAutoSquash(octokit, pullRequestData)
}

/**
 * @param {import('probot').Context<"release">} context
 */
const updateRepositoryDependencies = async (context) => {
  await Promise.all(
    dependencies.map((dependency) => {
      return updateDependencies(context, dependency)
    }),
  )
}

/**
 * @param {import('probot').Context<"release">} context
 */
const handleReleaseReleased = async (context) => {
  await Promise.all([
    updateBuiltinExtensions(context),
    updateRepositoryDependencies(context),
  ])
}

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.on('release.released', handleReleaseReleased)
}
