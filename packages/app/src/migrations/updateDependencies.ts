import { captureException } from '../errorHandling.js'
import dependenciesConfig from '../dependencies.json' with { type: 'json' }
import type { Migration, MigrationParams, MigrationResult } from './types.js'
import { applyMigrationResult } from './applyMigrationResult.js'

interface RpcMigrationResult {
  status: 'success' | 'error'
  changedFiles: Array<{ path: string; content: string }>
  pullRequestTitle: string
  errorCode?: string
  errorMessage?: string
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

const quickJoin = (parentFolder: string, childPath: string): string => {
  if (!parentFolder) {
    return childPath
  }
  return parentFolder + '/' + childPath
}

const getPackageRefs = async (
  octokit: MigrationParams['octokit'],
  owner: string,
  repo: string,
  packageJsonPath: string,
  packageLockJsonPath: string,
) => {
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

const updateDependenciesForRepo = async (
  params: MigrationParams,
  config: any,
  tagName: string,
): Promise<MigrationResult> => {
  const { octokit, owner, baseBranch = 'main', migrationsRpc } = params
  const releasedRepo = config.fromRepo
  const packageJsonPath = quickJoin(config.toFolder, 'package.json')
  const packageLockJsonPath = quickJoin(config.toFolder, 'package-lock.json')
  const version = tagName.replace('v', '')

  const newBranch = `update-version/${releasedRepo}-${tagName}`
  const repoToUpdate = config.toRepo
  const dependencyNameShort = config.asName || releasedRepo
  const dependencyName = `@lvce-editor/${dependencyNameShort}`

  // First, read package.json to determine which dependency key to use
  const { packageJsonRef, packageLockJsonRef } = await getPackageRefs(
    octokit,
    owner,
    repoToUpdate,
    packageJsonPath,
    packageLockJsonPath,
  )

  if (
    !('content' in packageJsonRef.data) ||
    !('content' in packageLockJsonRef.data)
  ) {
    return {
      success: true,
      message: 'No content in files',
    }
  }

  const filesJsonBase64 = packageJsonRef.data.content
  const filesJsonDecoded = Buffer.from(filesJsonBase64, 'base64').toString()
  const filesJsonValue = JSON.parse(filesJsonDecoded)

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

  // Call RPC function to get new package files
  const rpcResult = (await migrationsRpc.invoke('getNewPackageFiles', {
    repositoryOwner: owner,
    repositoryName: repoToUpdate,
    dependencyName: releasedRepo,
    dependencyKey,
    newVersion: version,
    packageJsonPath,
    packageLockJsonPath,
  })) as RpcMigrationResult

  if (rpcResult.status === 'error') {
    return {
      success: false,
      error: rpcResult.errorMessage || 'Failed to get new package files',
    }
  }

  if (rpcResult.changedFiles.length === 0) {
    return {
      success: true,
      message: 'No changes needed',
    }
  }

  const commitMessage = getCommitMessage(releasedRepo, tagName)
  const pullRequestTitle = rpcResult.pullRequestTitle

  // Apply the migration result
  return await applyMigrationResult(
    { ...params, repo: repoToUpdate },
    rpcResult.changedFiles,
    pullRequestTitle,
    commitMessage,
    newBranch,
  )
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
      const matchingDependencies = dependencies.filter(
        (dep) => dep.fromRepo === repo,
      )

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
          const result = await updateDependenciesForRepo(
            { ...params, repo: dependency.toRepo },
            dependency,
            tagName,
          )
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
        error:
          failed.length > 0 ? failed.map((r) => r.error).join('; ') : undefined,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
