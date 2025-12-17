import { join } from 'node:path'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'
import { createMigrationResult } from '../GetHttpStatusCode/GetHttpStatusCode.ts'

const WORKFLOWS_DIR = '.github/workflows'

const updateOsVersionsInYaml = (
  yamlContent: string,
  osVersions: {
    ubuntu?: string
    windows?: string
    macos?: string
  },
): string => {
  let updated = yamlContent
  if (osVersions.ubuntu) {
    updated = updated.replace(/ubuntu-\d{2}\.\d{2}/g, `ubuntu-${osVersions.ubuntu}`)
  }
  if (osVersions.windows) {
    updated = updated.replace(/windows-\d{4}/g, `windows-${osVersions.windows}`)
  }
  if (osVersions.macos) {
    updated = updated.replace(/macos-\d+/g, `macos-${osVersions.macos}`)
  }
  return updated
}

export interface UpdateGithubActionsOptions extends BaseMigrationOptions {
  ubuntu?: string
  windows?: string
  macos?: string
}

export const updateGithubActions = async (options: Readonly<UpdateGithubActionsOptions>): Promise<MigrationResult> => {
  try {
    const workflowsPath = join(options.clonedRepoPath, WORKFLOWS_DIR)

    // Check if workflows directory exists
    let entries: any[]
    try {
      entries = await options.fs.readdir(workflowsPath, {
        withFileTypes: true,
      })
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        // No workflows directory, nothing to do
        return createMigrationResult({
          status: 'success',
          changedFiles: [],
          pullRequestTitle: 'ci: update CI OS versions',
        })
      }
      throw error
    }

    const osVersions = {
      ubuntu: options.ubuntu,
      windows: options.windows,
      macos: options.macos,
    }

    const changedFiles: Array<{ path: string; content: string }> = []

    // Process each workflow file
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue
      }

      const fileName = entry.name
      if (!fileName.endsWith('.yml') && !fileName.endsWith('.yaml')) {
        continue
      }

      const filePath = join(workflowsPath, fileName)
      const relativePath = join(WORKFLOWS_DIR, fileName)

      try {
        const content = await options.fs.readFile(filePath, 'utf8')
        const updated = updateOsVersionsInYaml(content, osVersions)

        if (updated !== content) {
          // Ensure trailing newline like repo style
          const finalContent = updated.endsWith('\n') ? updated : updated + '\n'
          changedFiles.push({
            path: relativePath,
            content: finalContent,
          })
        }
      } catch (error: any) {
        if (error && error.code === 'ENOENT') {
          continue
        }
        throw error
      }
    }

    return createMigrationResult({
      status: 'success',
      changedFiles,
      pullRequestTitle: 'ci: update CI OS versions',
    })
  } catch (error: any) {
    return createMigrationResult({
      status: 'error',
      changedFiles: [],
      pullRequestTitle: 'ci: update CI OS versions',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  }
}
