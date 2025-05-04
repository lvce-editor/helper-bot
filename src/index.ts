import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleDependencies } from './dependencies.js'
import { Context, Probot } from 'probot'

const dependencies = [
  {
    fromRepo: 'eslint-config',
    toRepo: 'text-search-worker',
    toFolder: '',
  },
  {
    fromRepo: 'test-worker',
    toRepo: 'test-with-playwright',
    toFolder: 'packages/build',
  },
  {
    fromRepo: 'eslint-config',
    toRepo: 'iframe-worker',
    toFolder: '',
  },
  {
    fromRepo: 'eslint-config',
    toRepo: 'file-watcher-process',
    toFolder: '',
  },
  {
    fromRepo: 'eslint-config',
    toRepo: 'test-worker',
    toFolder: '',
  },
  {
    fromRepo: 'renderer-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'embeds-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'main-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/main-process',
  },
  {
    fromRepo: 'iframe-inspector',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'markdown-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'terminal-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'test-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-host-sub-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'title-bar-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'explorer-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'editor-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'error-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'diff-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'keybindings-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-search-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-detail-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'iframe-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-host-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'syntax-highlighting-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'about-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'source-control-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
    asName: 'source-control-worker',
  },
  {
    fromRepo: 'file-search-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'text-search-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'virtual-dom',
    toRepo: 'renderer-process',
    toFolder: 'packages/renderer-process',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'renderer-process',
    toFolder: 'packages/renderer-process',
  },
  {
    fromRepo: 'preview-injected-code',
    toRepo: 'preview-process',
    toFolder: 'packages/preview-process',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'rpc',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'rpc',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'test-worker',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'typescript-compile-process',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'extension-host-worker',
    toFolder: 'packages/extension-host-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'extension-host-worker',
    toFolder: 'packages/extension-host-sub-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'iframe-worker',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'iframe-worker',
    toFolder: 'packages/iframe-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'about-view',
    toFolder: 'packages/about-view',
  },
  {
    fromRepo: 'rpc-registry',
    toRepo: 'about-view',
    toFolder: 'packages/about-view',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'file-search-worker',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'text-search-worker',
    toFolder: 'packages/text-search-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'explorer-view',
    toFolder: 'packages/explorer-view',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'editor-worker',
    toFolder: '',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'syntax-highlighting-worker',
    toFolder: '',
  },
  {
    fromRepo: 'ripgrep',
    toRepo: 'search-process',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'search-process',
    toFolder: '',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'lvce-editor',
    toFolder: 'packages/main-process',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'editor-worker',
    toFolder: '',
  },
  {
    fromRepo: 'command',
    toRepo: 'file-search-worker',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'renderer-process',
    toFolder: 'packages/renderer-process',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'preview-process',
    toFolder: 'packages/preview-process',
  },
  {
    fromRepo: 'preview-injected-code',
    toRepo: 'preview-process',
    toFolder: '/packages/preview-process',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'test-worker',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'syntax-highlighting-worker',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'iframe-worker',
    toFolder: '',
  },
  {
    fromRepo: 'network-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'file-system-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'file-watcher-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'preview-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'search-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'pty-host',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'preload',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
]

const getNewValue = (
  value: readonly any[],
  repoName: string,
  version: string,
) => {
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

const shortCommitMessageRepos = [
  'renderer-process',
  'editor-worker',
  'text-search-worker',
  'file-search-worker',
  'virtual-dom',
  'iframe-worker',
]

const shouldUseShortCommitMessage = (releasedRepo: string): boolean => {
  return shortCommitMessageRepos.includes(releasedRepo)
}

const getCommitMessage = (releasedRepo: string, tagName: string): string => {
  if (shouldUseShortCommitMessage(releasedRepo)) {
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

const enableAutoSquash = async (
  octokit: Context<'release'>['octokit'],
  pullRequestData: any,
) => {
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

const updateBuiltinExtensions = async (context: Context<'release'>) => {
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

const getNewPackageFiles = async (
  oldPackageJson: any,
  dependencyName: string,
  dependencyKey: string,
  newVersion: string,
) => {
  const name = oldPackageJson.name
  const tmpFolder = join(
    tmpdir(),
    `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp`,
  )
  const tmpCacheFolder = join(
    tmpdir(),
    `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp-cache`,
  )
  const toRemove = [tmpFolder, tmpCacheFolder]
  try {
    oldPackageJson[dependencyKey][`@lvce-editor/${dependencyName}`] =
      `^${newVersion}`
    const oldPackageJsonStringified =
      JSON.stringify(oldPackageJson, null, 2) + '\n'
    await mkdir(tmpFolder, { recursive: true })
    await writeFile(join(tmpFolder, 'package.json'), oldPackageJsonStringified)
    const { execa } = await import('execa')
    await execa(
      `npm`,
      [
        'install',
        '--ignore-scripts',
        '--prefer-online',
        '--cache',
        tmpCacheFolder,
      ],
      {
        cwd: tmpFolder,
      },
    )
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
    for (const folder of toRemove) {
      await rm(folder, {
        recursive: true,
        force: true,
      })
    }
  }
}

const modeFile: '100644' = '100644'

const typeFile: 'blob' = 'blob'

const createPullRequest = async ({
  baseBranch,
  newBranch,
  octokit,
  owner,
  repo,
  commitableFiles,
  commitMessage,
  pullRequestTitle,
}: {
  baseBranch: string
  newBranch: string
  octokit: Context<'release'>['octokit']
  owner: string
  repo: string
  commitableFiles: readonly any[]
  commitMessage: string
  pullRequestTitle: string
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
    // @ts-ignore
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

const quickJoin = (parentFolder: string, childPath: string) => {
  if (!parentFolder) {
    return childPath
  }
  return parentFolder + '/' + childPath
}

const getPackageRefs = async (
  context: Context<'release'>,
  owner: string,
  repo: string,
  packageJsonPath: string,
  packageLockJsonPath: string,
) => {
  const [packageJsonRef, packageLockJsonRef] = await Promise.all([
    context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: packageJsonPath,
    }),
    context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: packageLockJsonPath,
    }),
  ])
  return {
    packageJsonRef,
    packageLockJsonRef,
  }
}

const updateDependencies = async (context: Context<'release'>, config: any) => {
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

  const { packageJsonRef, packageLockJsonRef } = await getPackageRefs(
    context,
    owner,
    repo,
    packageJsonPath,
    packageLockJsonPath,
  )

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
  const dependencyNameShort = config.asName || releasedRepo
  const dependencyName = `@lvce-editor/${dependencyNameShort}`
  let dependencyKey = ''
  let oldDependency = ''
  if (
    filesJsonValue.dependencies &&
    filesJsonValue.dependencies[dependencyName]
  ) {
    dependencyKey = 'dependencies'
    oldDependency = filesJsonValue.dependencies[dependencyName]
  } else if (
    filesJsonValue.devDependencies &&
    filesJsonValue.devDependencies[dependencyName]
  ) {
    dependencyKey = 'devDependencies'
    oldDependency = filesJsonValue.devDependencies[dependencyName]
  } else if (
    filesJsonValue.optionalDependencies &&
    filesJsonValue.optionalDependencies[dependencyName]
  ) {
    dependencyKey = 'optionalDependencies'
    oldDependency = filesJsonValue.optionalDependencies[dependencyName]
  } else {
    console.warn(
      `dependency ${dependencyName} not found in ${packageJsonPath} of ${repo}`,
    )
    return
  }
  const oldVersion = oldDependency.slice(1)

  console.log({ oldVersion })
  if (oldVersion === version) {
    console.info('same version')
    return
  }
  const { newPackageJsonString, newPackageLockJsonString } =
    await getNewPackageFiles(
      filesJsonValue,
      config.fromRepo,
      dependencyKey,
      version,
    )

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

const updateRepositoryDependencies = async (context: Context<'release'>) => {
  for (const dependency of dependencies) {
    try {
      await updateDependencies(context, dependency)
    } catch (error) {
      console.error(error)
    }
  }
}

const handleReleaseReleased = async (context: Context<'release'>) => {
  await Promise.all([
    updateBuiltinExtensions(context),
    updateRepositoryDependencies(context),
  ])
}

const handleHelloWorld = (req: any, res: any) => {
  res.send('Hello World')
}

const enableCustomRoutes = async (app: Probot, getRouter: any) => {
  if (!getRouter || typeof getRouter !== 'function') {
    return
  }
  const router = getRouter('/my-app')

  router.get('/hello-world', handleHelloWorld)

  const installationIdString = process.env.INSTALLATION_ID
  if (!installationIdString) {
    throw new Error('installation id not found')
  }
  const installationId = parseInt(installationIdString)

  router.post(
    '/update-dependencies',
    handleDependencies({
      app,
      installationId,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )
}

export default (app: Probot, { getRouter }: any) => {
  enableCustomRoutes(app, getRouter)
  app.on('release.released', handleReleaseReleased)
}
