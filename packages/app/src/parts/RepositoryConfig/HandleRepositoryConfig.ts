import type { Context, Probot } from 'probot'
import {
  applyRequest,
  assertRequest,
  isTrustedAuthor,
  readConfig,
  validateRequest,
  WORKFLOW_PATH,
  WORKFLOW_PREFIX,
  type ConfigRequest,
} from './RepositoryConfig.ts'

const getOctokit = async (app: Probot, repository: string): Promise<any> => {
  const [owner, repo] = repository.split('/')
  const auth = await app.auth()
  const { data } = await auth.rest.apps.getRepoInstallation({ owner, repo })
  return { octokit: await app.auth(data.id), permissions: data.permissions }
}

export const createHandleConfigChecksCompleted =
  (app: Probot) =>
  async (context: Context<'workflow_run'>): Promise<void> => {
    const { repository, workflow_run: run } = context.payload
    if (repository.owner.login !== 'lvce-editor' || run.event !== 'pull_request' || run.conclusion !== 'success') {
      return
    }
    for (const associated of run.pull_requests || []) {
      const target = `${repository.owner.login}/${repository.name}`
      const { data: pr } = await context.octokit.rest.pulls.get({ owner: repository.owner.login, repo: repository.name, pull_number: associated.number })
      if (
        !isTrustedAuthor(pr.user) ||
        pr.state !== 'open' ||
        pr.draft ||
        pr.head.sha !== run.head_sha ||
        pr.head.repo?.full_name !== target ||
        pr.base.ref !== 'main'
      ) {
        continue
      }
      // Unconfigured repositories are deliberately opt-in. Bootstrap a live snapshot on main first.
      try {
        await readConfig(context.octokit, target, pr.base.sha)
      } catch (error: any) {
        if (error.status === 404) {
          continue
        }
        throw error
      }
      const request: ConfigRequest = { repository: target, pullRequest: pr.number, headSha: pr.head.sha, baseSha: pr.base.sha }
      // A workflow completion can arrive while other workflows are still pending.
      // Dispatch only after the complete matrix has been verified; the job and applier verify it again.
      try {
        const validated = await validateRequest(context.octokit, request)
        if (!validated.changed) {
          continue
        }
      } catch (error) {
        context.log.warn({ err: error }, 'Repository configuration is not ready to apply')
        continue
      }
      const { octokit } = await getOctokit(app, 'lvce-editor/helper-bot')
      await octokit.rest.actions.createWorkflowDispatch({
        owner: 'lvce-editor',
        repo: 'helper-bot',
        ref: 'main',
        workflow_id: 'apply-repository-config.yml',
        inputs: { repository: request.repository, pullRequest: String(request.pullRequest), headSha: request.headSha, baseSha: request.baseSha },
      })
    }
  }

export const requestFromRunName = (name: string): ConfigRequest => {
  const match = /^repository-config\/(lvce-editor\/[a-zA-Z0-9._-]+)\/(\d+)\/([a-f0-9]{40})\/([a-f0-9]{40})$/.exec(name)
  if (!match) {
    throw new Error('Invalid repository config workflow identity')
  }
  const request = { repository: match[1], pullRequest: Number(match[2]), headSha: match[3], baseSha: match[4] }
  assertRequest(request)
  return request
}

export const createHandleConfigApplicationCompleted =
  (app: Probot) =>
  async (context: Context<'workflow_run'>): Promise<void> => {
    const { repository, workflow_run: payloadRun } = context.payload
    if (
      repository.full_name !== 'lvce-editor/helper-bot' ||
      payloadRun.path !== WORKFLOW_PATH ||
      !((payloadRun as any).display_title || '').startsWith(WORKFLOW_PREFIX)
    ) {
      return
    }
    // Validate the authoritative run record, not merely the webhook's revision and conclusion.
    const { data: run } = await context.octokit.rest.actions.getWorkflowRun({ owner: 'lvce-editor', repo: 'helper-bot', run_id: payloadRun.id })
    const { data: main } = await context.octokit.rest.git.getRef({ owner: 'lvce-editor', repo: 'helper-bot', ref: 'heads/main' })
    if (
      run.path !== WORKFLOW_PATH ||
      run.event !== 'workflow_dispatch' ||
      run.head_branch !== 'main' ||
      run.head_sha !== main.object.sha ||
      run.status !== 'completed' ||
      !isTrustedAuthor(run.actor)
    ) {
      throw new Error('Untrusted or stale config application workflow')
    }
    const request = requestFromRunName(run.display_title)
    const { octokit, permissions } = await getOctokit(app, request.repository)
    const [owner, repo] = request.repository.split('/')
    // The application result is posted only after privileged writes finish. Workflow success alone is not application success.
    try {
      if (run.conclusion !== 'success') {
        throw new Error(`Config validation workflow failed: ${run.conclusion}`)
      }
      await applyRequest(octokit, request, permissions)
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: request.pullRequest,
        body: `Repository configuration applied for ${request.headSha}. Validation: ${run.html_url}`,
      })
    } catch (error) {
      context.log.error({ err: error }, 'Repository configuration application failed')
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: request.pullRequest,
        body: `Repository configuration was not confirmed applied for ${request.headSha}. Inspect ${run.html_url} and the helper-bot application log; reconcile live settings before retrying.`,
      })
      throw error
    }
  }
