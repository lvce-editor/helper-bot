import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { emptyMigrationResult, getHttpStatusCode } from '../GetHttpStatusCode/GetHttpStatusCode.ts'
import { normalizePath } from '../UriUtils/UriUtils.ts'

const WORKFLOWS_DIR = '.github/workflows'
const TARGET_FILES = ['pr.yml', 'ci.yml', 'release.yml']

const updateRunnerVersionsInYaml = (yamlContent: string): string => {
  let updated = yamlContent
  // Update Ubuntu versions (e.g., ubuntu-22.04 -> ubuntu-24.04)
  updated = updated.replaceAll(/ubuntu-22\.04/g, 'ubuntu-24.04')
  updated = updated.replaceAll(/ubuntu-20\.04/g, 'ubuntu-24.04')
  // Update macOS versions (e.g., macos-14 -> macos-15)
  updated = updated.replaceAll(/macos-14/g, 'macos-15')
  updated = updated.replaceAll(/macos-13/g, 'macos-15')
  updated = updated.replaceAll(/macos-12/g, 'macos-15')
  // Update Windows versions (e.g., windows-2022 -> windows-2025)
  updated = updated.replaceAll(/windows-2022/g, 'windows-2025')
  updated = updated.replaceAll(/windows-2019/g, 'windows-2025')
  return updated
}

export type UpdateCiVersionsOptions = BaseMigrationOptions

export const updateCiVersions = async (options: Readonly<UpdateCiVersionsOptions>): Promise<MigrationResult> => {
  try {
    // Ensure clonedRepoUri ends with / for proper URL resolution
    const baseUri = options.clonedRepoUri.endsWith('/') ? options.clonedRepoUri : options.clonedRepoUri + '/'
    const workflowsPath = new URL(WORKFLOWS_DIR + '/', baseUri).toString()

    // Check if workflows directory exists
    let entries: any[]
    try {
      entries = await options.fs.readdir(workflowsPath, {
        withFileTypes: true,
      })
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        // No workflows directory, nothing to do
        return emptyMigrationResult
      }
      throw error
    }

    const changedFiles: Array<{ path: string; content: string }> = []

    // Process each target workflow file
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue
      }

      const fileName = entry.name
      if (!TARGET_FILES.includes(fileName)) {
        continue
      }

      const filePath = new URL(fileName, workflowsPath).toString()
      const relativePath = normalizePath(`${WORKFLOWS_DIR}/${fileName}`)

      console.log('DEBUG trying to read file:', filePath)

      try {
        const content = await options.fs.readFile(filePath, 'utf8')
        console.log('DEBUG read file content:', content.substring(0, 100))
        const updated = updateRunnerVersionsInYaml(content)
        console.log('DEBUG updated content:', updated.substring(0, 100))
        console.log('DEBUG content === updated:', content === updated)

        if (updated !== content) {
          // Ensure trailing newline like repo style
          const finalContent = updated.endsWith('\n') ? updated : updated + '\n'
          console.log('DEBUG adding to changedFiles')
          changedFiles.push({
            content: finalContent,
            path: relativePath,
          })
        } else {
          console.log('DEBUG content unchanged')
        }
      } catch (error: any) {
        console.log('DEBUG error reading file:', error.message, 'code:', error.code)
        if (error && error.code === 'ENOENT') {
          console.log('DEBUG file not found, continuing')
          continue
        }
        throw error
      }
    }

    if (changedFiles.length === 0) {
      return emptyMigrationResult
    }

    return {
      branchName: 'feature/update-ci-versions',
      changedFiles,
      commitMessage: 'ci: update CI runner versions',
      pullRequestTitle: 'ci: update CI runner versions',
      status: 'success',
      statusCode: 200,
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

