import { readFileSync } from 'node:fs'

type DependencyConfig = {
  dependencies: readonly any[]
  releaseCron: {
    expression: string
    timezone: string
  }
  releaseExcludedRepos: readonly string[]
}

const dependenciesConfigUrl = new URL('../dependencies.json', import.meta.url)
const defaultReleaseCron = {
  expression: '0 3 * * *',
  timezone: 'Europe/Berlin',
}
const defaultReleaseExcludedRepos = ['accounting', 'test-worker'] as const

export const getDependenciesConfig = (): DependencyConfig => {
  const content = readFileSync(dependenciesConfigUrl, 'utf8')
  const config = JSON.parse(content)
  return {
    dependencies: config.dependencies || [],
    releaseCron: {
      ...defaultReleaseCron,
      ...config.releaseCron,
    },
    releaseExcludedRepos: config.releaseExcludedRepos || defaultReleaseExcludedRepos,
  }
}
