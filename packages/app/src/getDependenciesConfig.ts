import { readFileSync } from 'node:fs'

type DependencyConfig = {
  dependencies: readonly any[]
  releaseExcludedRepos: readonly string[]
}

const dependenciesConfigUrl = new URL('../dependencies.json', import.meta.url)
const defaultReleaseExcludedRepos = ['accounting', 'test-worker'] as const

export const getDependenciesConfig = (): DependencyConfig => {
  const content = readFileSync(dependenciesConfigUrl, 'utf8')
  const config = JSON.parse(content)
  return {
    dependencies: config.dependencies || [],
    releaseExcludedRepos: config.releaseExcludedRepos || defaultReleaseExcludedRepos,
  }
}
