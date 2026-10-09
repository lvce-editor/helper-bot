import { ProbotOctokit } from 'probot'
import { fileURLToPath } from 'node:url'
import { validateRequest } from './RepositoryConfig.ts'

export const validateWorkflow = async (): Promise<void> => {
  if (
    process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    process.env.GITHUB_REPOSITORY !== 'lvce-editor/helper-bot'
  ) {
    throw new Error('Config validation must execute trusted helper-bot main')
  }
  const octokit = new ProbotOctokit({ auth: process.env.GITHUB_TOKEN })
  const validated = await validateRequest(octokit, {
    repository: process.env.TARGET_REPOSITORY || '',
    pullRequest: Number(process.env.PULL_REQUEST),
    headSha: process.env.HEAD_SHA || '',
    baseSha: process.env.BASE_SHA || '',
  })
  if (!validated.changed) {
    throw new Error('No repository configuration change')
  }
  console.info('Repository configuration validated; helper-bot will revalidate before application.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await validateWorkflow()
}
