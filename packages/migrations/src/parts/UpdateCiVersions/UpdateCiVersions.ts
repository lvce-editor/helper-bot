import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'
import config from './config.json' with { type: 'json' }

const WORKFLOWS_DIR = '.github/workflows'
const TARGET_FILES = ['pr.yml', 'ci.yml', 'release.yml']

// Regex patterns for matching runner versions
const UBUNTU_VERSION_REGEX = /ubuntu-\d+\.\d+/g
const MACOS_VERSION_REGEX = /macos-\d+/g
const WINDOWS_VERSION_REGEX = /windows-\d{4}/g

interface CiVersionsConfig {
  latestVersions: {
    ubuntu: string
    macos: string
    windows: string
  }
}

const isTargetWorkflowFile = (entry: Readonly<{ isFile: () => boolean; name: string }>): boolean => {
  return entry.isFile() && TARGET_FILES.includes(entry.name)
}

const getUpdatedWorkflowFile = async (
  options: Readonly<UpdateCiVersionsOptions>,
  workflowsPath: string,
  entry: Readonly<{ name: string; isFile: () => boolean }>,
): Promise<{ content: string; path: string } | undefined> => {
  if (!isTargetWorkflowFile(entry)) {
    return undefined
  }

  const fileName = entry.name
  const filePath = new URL(fileName, workflowsPath).toString()
  const relativePath = normalizePath(`${WORKFLOWS_DIR}/${fileName}`)

  try {
    const content = await options.fs.readFile(filePath, 'utf8')
    const updated = updateRunnerVersionsInYaml(content, config.latestVersions)
    if (updated === content) {
      return undefined
    }
    return {
      content: updated.endsWith('\n') ? updated : `${updated}\n`,
      path: relativePath,
    }
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

const updateRunnerVersionsInYaml = (yamlContent: string, versions: CiVersionsConfig['latestVersions']): string => {
  let updated = yamlContent
  // Update Ubuntu versions to latest (e.g., ubuntu-22.04 -> ubuntu-24.04)
  updated = updated.replaceAll(UBUNTU_VERSION_REGEX, `ubuntu-${versions.ubuntu}`)
  // Update macOS versions to latest (e.g., macos-14 -> macos-15)
  updated = updated.replaceAll(MACOS_VERSION_REGEX, `macos-${versions.macos}`)
  // Update Windows versions to latest (e.g., windows-2022 -> windows-2025)
  updated = updated.replaceAll(WINDOWS_VERSION_REGEX, `windows-${versions.windows}`)
  return updated
}

export type UpdateCiVersionsOptions = BaseMigrationOptions

export const updateCiVersions = async (options: Readonly<UpdateCiVersionsOptions>): Promise<MigrationResult> => {
  try {
    // Ensure clonedRepoUri ends with / for proper URL resolution
    const baseUri = options.clonedRepoUri.endsWith('/') ? options.clonedRepoUri : options.clonedRepoUri + '/'
    const workflowsPath = new URL(WORKFLOWS_DIR + '/', baseUri).toString()

    // Check if workflows directory exists
    const workflowsExists = await options.fs.exists(workflowsPath)
    if (!workflowsExists) {
      return emptyMigrationResult
    }

    const entries = await options.fs.readdir(workflowsPath, {
      withFileTypes: true,
    })

    const changedFiles: Array<{ path: string; content: string }> = []

    for (const entry of entries) {
      const updatedFile = await getUpdatedWorkflowFile(options, workflowsPath, entry)
      if (updatedFile) {
        changedFiles.push(updatedFile)
      }
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/update-ci-versions',
      changedFiles,
      commitMessage: 'feature: update runner versions',
      pullRequestTitle: 'feature: update runner versions',
      status: 'success',
      statusCode: 201,
    }
  } catch (error: any) {
    const errorResult = {
      errorMessage: error instanceof Error ? error.message : String(error),
      status: 'error' as const,
    }
    return {
      changedFiles: [],
      errorMessage: errorResult.errorMessage,
      status: 'error',
      statusCode: getHttpStatusCode(errorResult),
    }
  }
}
