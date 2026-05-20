import { readFileSync } from 'node:fs'

type DependencyConfig = {
  dependencies: readonly any[]
}

const dependenciesConfigUrl = new URL('../dependencies.json', import.meta.url)

export const getDependenciesConfig = (): DependencyConfig => {
  const content = readFileSync(dependenciesConfigUrl, 'utf8')
  return JSON.parse(content)
}
