import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'probot'
import { createPullRequest } from './createPullRequest.js'
import { captureException } from './errorHandling.js'

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
    captureException(error as Error)
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

export const updateDependencies = async (
  context: Context<'release'>,
  config: any,
) => {
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

  // Check if .gitattributes file needs to be added
  let gitattributesContent: string | null = null
  try {
    // Check if .gitattributes exists using GitHub API
    await octokit.rest.repos.getContent({
      owner,
      repo,
      path: '.gitattributes',
    })
    // If we get here, the file exists, so we don't need to add it
    console.log('.gitattributes file already exists')
  } catch (error: any) {
    // If the file doesn't exist (404), we need to add it
    if (error.status === 404) {
      console.log('.gitattributes file not found, will add it')
      gitattributesContent = '* text=auto eol=lf\n'
    } else {
      // Some other error occurred
      console.warn('Failed to check for .gitattributes file:', error)
    }
  }

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

  // Add .gitattributes file if it needs to be created
  if (gitattributesContent) {
    commitableFiles.push({
      path: '.gitattributes',
      mode: modeFile,
      type: typeFile,
      content: gitattributesContent,
    })
  }

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
