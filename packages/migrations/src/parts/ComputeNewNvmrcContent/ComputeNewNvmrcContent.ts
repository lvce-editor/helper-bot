import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cloneRepositoryTmp } from '../CloneRepositoryTmp/CloneRepositoryTmp.ts'
import type { BaseMigrationOptions, MigrationResult } from '../Types/Types.ts'

const parseVersion = (content: string): number => {
  const trimmed = content.trim()
  if (trimmed.startsWith('v')) {
    return parseInt(trimmed.slice(1))
  }
  return parseInt(trimmed)
}

const computeNewNvmrcContentCore = (
  currentContent: string,
  newVersion: string,
): { newContent: string; shouldUpdate: boolean } => {
  try {
    const existingVersionNumber = parseVersion(currentContent)
    const newVersionNumber = parseVersion(newVersion)
    if (existingVersionNumber > newVersionNumber) {
      return {
        newContent: currentContent,
        shouldUpdate: false,
      }
    }
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  } catch (error) {
    // If parsing fails, assume we should update
    return {
      newContent: `${newVersion}\n`,
      shouldUpdate: true,
    }
  }
}

export interface ComputeNewNvmrcContentOptions extends BaseMigrationOptions {
  newVersion: string
}

export const computeNewNvmrcContent = async (
  options: ComputeNewNvmrcContentOptions,
): Promise<MigrationResult> => {
  const clonedRepo = await cloneRepositoryTmp(
    options.repositoryOwner,
    options.repositoryName,
  )
  try {
    const nvmrcPath = join(clonedRepo.path, '.nvmrc')

    let currentContent: string
    try {
      currentContent = await readFile(nvmrcPath, 'utf8')
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return {
          status: 'success',
          changedFiles: [],
          pullRequestTitle: `ci: update Node.js to version ${options.newVersion}`,
        }
      }
      throw error
    }

    const result = computeNewNvmrcContentCore(currentContent, options.newVersion)
    const pullRequestTitle = `ci: update Node.js to version ${options.newVersion}`

    if (!result.shouldUpdate) {
      return {
        status: 'success',
        changedFiles: [],
        pullRequestTitle,
      }
    }

    const hasChanges = currentContent !== result.newContent

    return {
      status: 'success',
      changedFiles: hasChanges
        ? [
            {
              path: '.nvmrc',
              content: result.newContent,
            },
          ]
        : [],
      pullRequestTitle,
    }
  } catch (error) {
    return {
      status: 'error',
      changedFiles: [],
      pullRequestTitle: `ci: update Node.js version`,
      errorCode: 'COMPUTE_NVMRC_CONTENT_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await clonedRepo[Symbol.asyncDispose]()
  }
}
