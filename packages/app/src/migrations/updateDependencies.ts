import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPullRequest } from '../createPullRequest.js'
import { captureException } from '../errorHandling.js'
import dependenciesConfig from '../dependencies.json' with { type: 'json' }
import type { Migration, MigrationParams, MigrationResult } from './types.js'

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

const enableAutoSquash = async (octokit: MigrationParams['octokit'], pullRequestData: any): Promise<void> => {
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
): Promise<{
  newPackageJsonString: string
  newPackageLockJsonString: string
}> => {
  const name = oldPackageJson.name
  const tmpFolder = join(tmpdir(), `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp`)
  const tmpCacheFolder = join(tmpdir(), `update-dependencies-${name}-${dependencyName}-${newVersion}-tmp-cache`)
  const toRemove = [tmpFolder, tmpCacheFolder]
  try {
    oldPackageJson[dependencyKey][`@lvce-editor/${dependencyName}`] = `^${newVersion}`
    const oldPackageJsonStringified = JSON.stringify(oldPackageJson, null, 2) + '\n'
    await mkdir(tmpFolder, { recursive: true })
    await writeFile(join(tmpFolder, 'package.json'), oldPackageJsonStringified)
    const { execa } = await import('execa')
    await execa(`npm`, ['install', '--ignore-scripts', '--prefer-online', '--cache', tmpCacheFolder], {
      cwd: tmpFolder,
    })
    const newPackageLockJsonString = await readFile(join(tmpFolder, 'package-lock.json'), 'utf8')
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

const quickJoin = (parentFolder: string, childPath: string): string => {
  if (!parentFolder) {
    return childPath
  }
  return parentFolder + '/' + childPath
}

const getPackageRefs = async (octokit: MigrationParams['octokit'], owner: string, repo: string, packageJsonPath: string, packageLockJsonPath: string) => {
  const [packageJsonRef, packageLockJsonRef] = await Promise.all([
    octokit.rest.repos.getContent({
      owner,
      repo,
      path: packageJsonPath,
    }),
    octokit.rest.repos.getContent({
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

const updateDependenciesForRepo = async (params: MigrationParams, config: any, tagName: string): Promise<MigrationResult> => {
  const { octokit, owner, baseBranch = 'main' } = params
  const releasedRepo = config.fromRepo
  const packageJsonPath = quickJoin(config.toFolder, 'package.json')
  const packageLockJsonPath = quickJoin(config.toFolder, 'package-lock.json')
  const version = tagName.replace('v', '')

  const newBranch = `update-version/${releasedRepo}-${tagName}`
  const repoToUpdate = config.toRepo

  const { packageJsonRef, packageLockJsonRef } = await getPackageRefs(octokit, owner, repoToUpdate, packageJsonPath, packageLockJsonPath)

  if (!('content' in packageJsonRef.data) || !('content' in packageLockJsonRef.data)) {
    return {
      success: true,
      message: 'No content in files',
    }
  }

  const filesJsonBase64 = packageJsonRef.data.content
  const filesJsonDecoded = Buffer.from(filesJsonBase64, 'base64').toString()
  const filesJsonValue = JSON.parse(filesJsonDecoded)
  const dependencyNameShort = config.asName || releasedRepo
  const dependencyName = `@lvce-editor/${dependencyNameShort}`
  let dependencyKey = ''
  let oldDependency = ''
  if (filesJsonValue.dependencies && filesJsonValue.dependencies[dependencyName]) {
    dependencyKey = 'dependencies'
    oldDependency = filesJsonValue.dependencies[dependencyName]
  } else if (filesJsonValue.devDependencies && filesJsonValue.devDependencies[dependencyName]) {
    dependencyKey = 'devDependencies'
    oldDependency = filesJsonValue.devDependencies[dependencyName]
  } else if (filesJsonValue.optionalDependencies && filesJsonValue.optionalDependencies[dependencyName]) {
    dependencyKey = 'optionalDependencies'
    oldDependency = filesJsonValue.optionalDependencies[dependencyName]
  } else {
    return {
      success: true,
      message: `Dependency ${dependencyName} not found in ${packageJsonPath} of ${repoToUpdate}`,
    }
  }
  const oldVersion = oldDependency.slice(1)

  if (oldVersion === version) {
    return {
      success: true,
      message: 'Same version, no update needed',
    }
  }
  const { newPackageJsonString, newPackageLockJsonString } = await getNewPackageFiles(filesJsonValue, config.fromRepo, dependencyKey, version)

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
    repo: repoToUpdate,
  })
  await enableAutoSquash(octokit, pullRequestData)

  return {
    success: true,
    changedFiles: 2,
    newBranch,
    message: `Updated ${releasedRepo} to version ${tagName}`,
  }
}

export const updateDependenciesMigration: Migration = {
  name: 'updateDependencies',
  description: 'Update dependencies based on release events',
  run: async (params: MigrationParams): Promise<MigrationResult> => {
    try {
      const { owner, repo } = params

      // This migration requires a tag name to work properly
      // For manual triggering, we'll need to get the latest release
      const { octokit } = params

      // Get the latest release for the repository
      const releases = await octokit.rest.repos.listReleases({
        owner,
        repo,
        per_page: 1,
      })

      if (releases.data.length === 0) {
        return {
          success: false,
          error: 'No releases found for this repository',
        }
      }

      const latestRelease = releases.data[0]
      const tagName = latestRelease.tag_name

      // Find dependencies that match this repository
      const dependencies = dependenciesConfig.dependencies
      const matchingDependencies = dependencies.filter((dep) => dep.fromRepo === repo)

      if (matchingDependencies.length === 0) {
        return {
          success: true,
          message: `No dependencies configured for repository ${repo}`,
        }
      }

      // Update each matching dependency
      const results: MigrationResult[] = []
      for (const dependency of matchingDependencies) {
        try {
          const result = await updateDependenciesForRepo({ ...params, repo: dependency.toRepo }, dependency, tagName)
          results.push(result)
        } catch (error) {
          captureException(error as Error)
          results.push({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const successful = results.filter((r) => r.success)
      const failed = results.filter((r) => !r.success)

      return {
        success: failed.length === 0,
        message: `Updated ${successful.length} dependencies, ${failed.length} failed`,
        error: failed.length > 0 ? failed.map((r) => r.error).join('; ') : undefined,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
