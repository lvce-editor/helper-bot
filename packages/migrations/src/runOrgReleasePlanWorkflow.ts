import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { planOrgReleaseTags } from './parts/PlanOrgReleaseTags/PlanOrgReleaseTags.ts'

const MIGRATION_ID = '/migrations2/plan-org-release-tags'
const defaultReleaseExcludedRepos = ['accounting', 'test-worker'] as const
const dependenciesConfigUrl = new URL('../../app/dependencies.json', import.meta.url)

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const writeJson = async (outputDir: string, fileName: string, value: unknown): Promise<void> => {
  await mkdir(outputDir, { recursive: true })
  await writeFile(join(outputDir, fileName), JSON.stringify(value, null, 2) + '\n')
}

const getReleaseExcludedRepos = (): readonly string[] => {
  const content = readFileSync(dependenciesConfigUrl, 'utf8')
  const config = JSON.parse(content)
  return config.releaseExcludedRepos || defaultReleaseExcludedRepos
}

const outputDir = getRequiredEnv('MIGRATION_ARTIFACT_DIR')
const requestId = getRequiredEnv('REQUEST_ID')
const generatedAt = new Date().toISOString()

try {
  const releasePlan = await planOrgReleaseTags({
    excludedRepos: getReleaseExcludedRepos(),
    ...(process.env.GITHUB_TOKEN && { githubToken: process.env.GITHUB_TOKEN }),
    now: generatedAt,
  })
  await writeJson(outputDir, 'manifest.json', {
    artifactKind: 'org-release-plan',
    generatedAt,
    migrationId: MIGRATION_ID,
    requestId,
    status: 'success',
  })
  await writeJson(outputDir, 'release-plan.json', releasePlan)
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  await writeJson(outputDir, 'manifest.json', {
    artifactKind: 'org-release-plan',
    errorMessage,
    generatedAt,
    migrationId: MIGRATION_ID,
    requestId,
    status: 'error',
  })
  process.exitCode = 1
}
