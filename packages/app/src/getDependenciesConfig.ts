import { readFileSync } from 'node:fs'
import { parseIssueLockingConfig, type IssueLockingConfig } from '@lvce-editor/lock-old-issues'

type DependencyConfig = {
  dependencies: readonly any[]
  releaseUpdates: readonly ReleaseUpdateConfig[]
  releaseExcludedRepos: readonly string[]
  issueLocking: IssueLockingConfig
}

type ReleaseUpdateConfig = {
  readonly fromRepo: string
  readonly toRepository: string
  readonly migrationId: string
  readonly includeReleaseTag?: boolean
  readonly updateType?: 'immediate' | 'perform-delayed-update'
}

const dependenciesConfigUrl = new URL('../dependencies.json', import.meta.url)
const defaultReleaseExcludedRepos = ['accounting', 'test-worker'] as const

export const getDependenciesConfig = (): DependencyConfig => {
  const content = readFileSync(dependenciesConfigUrl, 'utf8')
  const config = JSON.parse(content)
  return {
    dependencies: config.dependencies || [],
    releaseUpdates: config.releaseUpdates || [],
    releaseExcludedRepos: config.releaseExcludedRepos || defaultReleaseExcludedRepos,
    issueLocking: parseIssueLockingConfig(config.issueLocking),
  }
}
