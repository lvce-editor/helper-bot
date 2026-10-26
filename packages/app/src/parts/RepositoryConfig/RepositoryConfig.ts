import { parse, parseDocument } from 'yaml'
import { assertOwnership, parseResources, planResources, type ResourceConfig } from './RepositoryResources.ts'
import { assertRulesetChecks } from './RepositoryRulesets.ts'

const CONFIG_PATH = '.github/repository-config.yml'
const LEGACY_CONFIG_PATH = '.github/repository-config.json'
export const WORKFLOW_PATH = '.github/workflows/apply-repository-config.yml'
export const WORKFLOW_PREFIX = 'repository-config/'
const ACTIONS_APP_ID = 15368
const LOCK_REF = 'heads/helper-bot-repository-config-lock'

export interface RepositoryConfig extends ResourceConfig {
  readonly version: 1
  readonly requiredStatusChecks: readonly string[]
  readonly rulesetId?: number
  readonly settings?: Readonly<Record<string, boolean | string>>
}

export interface ConfigRequest {
  readonly repository: string
  readonly pullRequest: number
  readonly headSha: string
  readonly baseSha: string
}

export const isTrustedAuthor = (user: Readonly<{ login: string; id: number }>): boolean => {
  return (user.login === 'levivilet' && user.id === 72156503) || (user.login === 'lvce-editor-helper-bot[bot]' && user.id === 155071229)
}

export const assertRequest = (request: Readonly<ConfigRequest>): void => {
  if (
    !/^lvce-editor\/[a-zA-Z0-9._-]+$/.test(request.repository) ||
    !Number.isSafeInteger(request.pullRequest) ||
    request.pullRequest < 1 ||
    !/^[a-f0-9]{40}$/.test(request.headSha) ||
    !/^[a-f0-9]{40}$/.test(request.baseSha)
  ) {
    throw new Error('Invalid repository config request')
  }
}

export const parseConfig = (text: string): RepositoryConfig => {
  if (Buffer.byteLength(text) > 65536) {
    throw new Error('Repository config is too large')
  }
  const document = parseDocument(text, { uniqueKeys: true, schema: 'core' })
  if (document.errors.length || document.warnings.length) {
    throw new Error('Invalid or ambiguous repository YAML')
  }
  const config = document.toJS({ maxAliasCount: 0 })
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    Object.keys(config).some(
      (key) =>
        ![
          'version',
          'requiredStatusChecks',
          'rulesetId',
          'settings',
          'topics',
          'labels',
          'milestones',
          'environments',
          'collaborators',
          'teams',
          'branches',
          'pages',
          'rulesets',
        ].includes(key),
    )
  ) {
    throw new Error('Invalid repository config fields')
  }
  if (
    config.version !== 1 ||
    !Array.isArray(config.requiredStatusChecks) ||
    config.requiredStatusChecks.length < 1 ||
    config.requiredStatusChecks.length > 100 ||
    config.requiredStatusChecks.some((name: unknown) => typeof name !== 'string' || name.length < 1 || name.length > 200) ||
    new Set(config.requiredStatusChecks).size !== config.requiredStatusChecks.length
  ) {
    throw new Error('Invalid required status checks')
  }
  if (config.rulesetId !== undefined && (!Number.isSafeInteger(config.rulesetId) || config.rulesetId < 1)) {
    throw new Error('Invalid ruleset id')
  }
  parseResources(config)
  return config
}

const equal = (left: readonly string[], right: readonly string[]): boolean => {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

// Fail closed for workflows whose intended jobs cannot be enumerated statically.
export const getWorkflowChecks = (text: string): readonly string[] => {
  const workflow = parse(text, { maxAliasCount: 0 })
  const triggers = workflow?.on
  const pullRequest =
    typeof triggers === 'string'
      ? triggers === 'pull_request'
      : Array.isArray(triggers)
        ? triggers.includes('pull_request')
        : Object.hasOwn(triggers || {}, 'pull_request')
  if (!pullRequest || !workflow.jobs || typeof workflow.jobs !== 'object') {
    throw new Error('Expected a pull_request workflow')
  }
  const checks: string[] = []
  for (const [id, job] of Object.entries(workflow.jobs) as [string, any][]) {
    if (job.if !== undefined || job.uses !== undefined || job.name !== undefined) {
      throw new Error('Conditional, reusable or renamed jobs require a trusted policy update')
    }
    if (!job.strategy) {
      checks.push(id)
      continue
    }
    const matrix = job.strategy.matrix
    if (
      !matrix ||
      Object.keys(matrix).length !== 1 ||
      !Array.isArray(matrix.os) ||
      matrix.os.length < 1 ||
      matrix.os.some((os: unknown) => typeof os !== 'string' || !/^[a-z0-9.-]+$/.test(os))
    ) {
      throw new Error('Unsupported workflow matrix')
    }
    checks.push(...matrix.os.map((os: string) => `${id} (${os})`))
  }
  if (checks.length < 1 || new Set(checks).size !== checks.length) {
    throw new Error('Invalid workflow jobs')
  }
  return checks
}

const readFile = async (octokit: any, repository: string, ref: string, path: string): Promise<string> => {
  const [owner, repo] = repository.split('/')
  const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref })
  if (data.type !== 'file' || data.encoding !== 'base64' || data.size > 65536) {
    throw new Error(`Invalid config data at ${path}`)
  }
  return Buffer.from(data.content, 'base64').toString('utf8')
}

export const readConfig = async (octokit: any, repository: string, ref: string): Promise<RepositoryConfig> => {
  let yaml: string | undefined
  let legacy: string | undefined
  for (const path of [CONFIG_PATH, LEGACY_CONFIG_PATH]) {
    try {
      const text = await readFile(octokit, repository, ref, path)
      if (path === CONFIG_PATH) yaml = text
      else legacy = text
    } catch (error: any) {
      if (error.status !== 404) throw error
    }
  }
  if (yaml !== undefined && legacy !== undefined) throw new Error('Remove legacy JSON when migrating to YAML')
  if (yaml === undefined && legacy === undefined) throw Object.assign(new Error('Repository is not configured'), { status: 404 })
  return parseConfig(yaml ?? legacy!)
}

const getPullRequest = async (octokit: any, request: Readonly<ConfigRequest>): Promise<any> => {
  assertRequest(request)
  const [owner, repo] = request.repository.split('/')
  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: request.pullRequest })
  const { data: main } = await octokit.rest.git.getRef({ owner, repo, ref: 'heads/main' })
  const trustedIdentity =
    pr.draft ||
    !isTrustedAuthor(pr.user) ||
    pr.base.ref !== 'main' ||
    pr.base.repo.full_name !== request.repository ||
    pr.head.repo?.full_name !== request.repository ||
    pr.head.sha !== request.headSha
  if (trustedIdentity) {
    throw new Error('Untrusted, closed or stale repository config PR')
  }
  if (pr.state === 'open' && pr.base.sha === request.baseSha && main.object.sha === request.baseSha) {
    return pr
  }
  // The configuration workflow can finish just after an otherwise valid PR is merged.
  // Accept that race only when GitHub's squash/merge commit contains exactly the
  // requested tree and is based on the configuration snapshot validated by CI.
  if (pr.state === 'closed' && pr.merged && pr.base.sha === request.baseSha && pr.merge_commit_sha) {
    const [mergedCommit, headCommit] = await Promise.all([
      octokit.rest.git.getCommit({ owner, repo, commit_sha: pr.merge_commit_sha }),
      octokit.rest.git.getCommit({ owner, repo, commit_sha: request.headSha }),
    ])
    const merged = mergedCommit.data
    if (merged.tree.sha === headCommit.data.tree.sha && merged.parents?.[0]?.sha === request.baseSha) {
      return pr
    }
  }
  throw new Error('Untrusted, closed or stale repository config PR')
}

export interface ValidatedConfig {
  readonly base: RepositoryConfig
  readonly desired: RepositoryConfig
  readonly changed: boolean
}

export const validateRequest = async (octokit: any, request: Readonly<ConfigRequest>): Promise<ValidatedConfig> => {
  await getPullRequest(octokit, request)
  const base = await readConfig(octokit, request.repository, request.baseSha)
  const desired = await readConfig(octokit, request.repository, request.headSha)
  if (base.rulesetId !== desired.rulesetId || !equal(Object.keys(base.settings || {}), Object.keys(desired.settings || {}))) {
    throw new Error('Configuration ownership must be bootstrapped on main; do not change managed fields in a PR')
  }
  assertOwnership(base, desired)
  const [owner, repo] = request.repository.split('/')
  const workflowChecks = async (ref: string): Promise<Map<string, readonly string[]>> => {
    const { data: files } = await octokit.rest.repos.getContent({ owner, repo, ref, path: '.github/workflows' })
    if (!Array.isArray(files) || files.length > 100) {
      throw new Error('Invalid workflows directory')
    }
    const result = new Map<string, readonly string[]>()
    for (const file of files) {
      if (!/\.ya?ml$/.test(file.name)) {
        continue
      }
      const text = await readFile(octokit, request.repository, ref, file.path)
      const workflow = parse(text, { maxAliasCount: 0 })
      const triggers = workflow?.on
      const isPr =
        typeof triggers === 'string'
          ? triggers === 'pull_request'
          : Array.isArray(triggers)
            ? triggers.includes('pull_request')
            : Object.hasOwn(triggers || {}, 'pull_request')
      if (isPr) {
        result.set(file.path, getWorkflowChecks(text))
      }
    }
    return result
  }
  const candidateWorkflows = await workflowChecks(request.headSha)
  const baselineWorkflows = await workflowChecks(request.baseSha)
  const expected = [...candidateWorkflows.values()].flat()
  const baseline = [...baselineWorkflows.values()].flat()
  // Runner version updates must preserve the existing platform matrix and workflow ownership.
  const platforms = (names: readonly string[]) => names.map((name) => name.replace(/\d+(?:\.\d+)*/g, '#'))
  if (
    !equal([...baselineWorkflows.keys()], [...candidateWorkflows.keys()]) ||
    !equal(platforms(baseline), platforms(expected)) ||
    !equal(desired.requiredStatusChecks, expected) ||
    new Set(expected).size !== expected.length
  ) {
    throw new Error('Required checks must match the complete workflow matrix and preserve platform coverage')
  }
  assertRulesetChecks(desired.rulesets || [], expected)
  const runs: any[] = await octokit.paginate(octokit.rest.actions.listWorkflowRunsForRepo, {
    owner,
    repo,
    head_sha: request.headSha,
    event: 'pull_request',
    per_page: 100,
  })
  // Select the latest attempt/run for each workflow. Old failed attempts must not veto a verified rerun.
  const latest = new Map<string, any>()
  for (const run of runs) {
    if (!latest.has(run.path) || latest.get(run.path).id < run.id) {
      latest.set(run.path, run)
    }
  }
  if ([...latest.values()].some((run) => run.status !== 'completed' || run.conclusion !== 'success')) {
    throw new Error('PR workflows have pending or failed checks')
  }
  for (const [path, checks] of candidateWorkflows) {
    const intended = latest.get(path)
    if (
      !intended ||
      intended.head_sha !== request.headSha ||
      !intended.pull_requests?.some((pr: any) => pr.number === request.pullRequest && pr.base.sha === request.baseSha)
    ) {
      throw new Error('Missing intended PR workflow for this revision and base')
    }
    // Check final-attempt jobs, rather than trusting caller-provided names or spoofable statuses.
    const jobs: any[] = await octokit.paginate(octokit.rest.actions.listJobsForWorkflowRunAttempt, {
      owner,
      repo,
      run_id: intended.id,
      attempt_number: intended.run_attempt,
      per_page: 100,
    })
    if (
      !equal(
        jobs.map((job) => job.name),
        checks,
      ) ||
      jobs.some((job) => job.status !== 'completed' || job.conclusion !== 'success')
    ) {
      throw new Error('Incomplete intended PR matrix')
    }
  }
  const checkRuns: any[] = await octokit.paginate(octokit.rest.checks.listForRef, { owner, repo, ref: request.headSha, filter: 'latest', per_page: 100 })
  if (checkRuns.some((check) => check.head_sha !== request.headSha || check.status !== 'completed' || check.conclusion !== 'success')) {
    throw new Error('Revision has pending or unsuccessful check runs')
  }
  const statuses: any[] = await octokit.paginate(octokit.rest.repos.listCommitStatusesForRef, { owner, repo, ref: request.headSha, per_page: 100 })
  const seenStatuses = new Set<string>()
  for (const status of statuses) {
    if (seenStatuses.has(status.context)) {
      continue
    }
    seenStatuses.add(status.context)
    if (status.state !== 'success') {
      throw new Error('Revision has pending or failed commit statuses')
    }
  }
  const changed = JSON.stringify(base) !== JSON.stringify(desired)
  return { base, changed, desired }
}

const assertSnapshot = (live: readonly string[], base: readonly string[], desired: readonly string[]): void => {
  if (!equal(live, base) && !equal(live, desired)) {
    throw new Error('Live settings conflict with the main configuration; reconcile before retrying')
  }
}

export const applyRequest = async (octokit: any, request: Readonly<ConfigRequest>, permissions: Readonly<Record<string, string>>): Promise<void> => {
  assertRequest(request)
  const [owner, repo] = request.repository.split('/')
  await getPullRequest(octokit, request)
  // Git ref creation is atomic across processes/replicas. Never steal an existing lock.
  await octokit.rest.git.createRef({ owner, repo, ref: `refs/${LOCK_REF}`, sha: request.baseSha })
  try {
    const { base, desired, changed } = await validateRequest(octokit, request)
    if (!changed) {
      return
    }
    const resourceWrites = await planResources(octokit, owner, repo, base, desired, permissions)
    let updateChecks: (() => Promise<unknown>) | undefined
    if (desired.rulesetId) {
      const { data: ruleset } = await octokit.request('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', { owner, repo, ruleset_id: desired.rulesetId })
      if (ruleset.source_type !== 'Repository' || ruleset.source !== request.repository || ruleset.target !== 'branch' || ruleset.enforcement !== 'active') {
        throw new Error('Only active repository-owned branch rulesets can be managed')
      }
      const rule = ruleset.rules.find((entry: any) => entry.type === 'required_status_checks')
      if (!rule || rule.parameters.required_status_checks.some((check: any) => check.integration_id !== ACTIONS_APP_ID)) {
        throw new Error('Unsupported ruleset checks')
      }
      const live = rule.parameters.required_status_checks.map((check: any) => check.context)
      assertSnapshot(live, base.requiredStatusChecks, desired.requiredStatusChecks)
      if (!equal(live, desired.requiredStatusChecks)) {
        updateChecks = () =>
          octokit.request('PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
            owner,
            repo,
            ruleset_id: desired.rulesetId,
            name: ruleset.name,
            target: ruleset.target,
            enforcement: ruleset.enforcement,
            conditions: ruleset.conditions,
            bypass_actors: ruleset.bypass_actors,
            rules: ruleset.rules.map((entry: any) =>
              entry.type === 'required_status_checks'
                ? {
                    ...entry,
                    parameters: {
                      ...entry.parameters,
                      required_status_checks: desired.requiredStatusChecks.map((context) => ({ context, integration_id: ACTIONS_APP_ID })),
                    },
                  }
                : entry,
            ),
          })
      }
    } else {
      const { data: live } = await octokit.rest.repos.getStatusChecksProtection({ owner, repo, branch: 'main' })
      if (live.checks.some((check: any) => check.app_id !== ACTIONS_APP_ID)) {
        throw new Error('Unsupported branch protection checks')
      }
      assertSnapshot(live.contexts, base.requiredStatusChecks, desired.requiredStatusChecks)
      if (!equal(live.contexts, desired.requiredStatusChecks)) {
        updateChecks = () =>
          octokit.rest.repos.updateStatusCheckProtection({
            owner,
            repo,
            branch: 'main',
            strict: live.strict,
            checks: desired.requiredStatusChecks.map((context) => ({ context, app_id: ACTIONS_APP_ID })),
          })
      }
    }
    const { data: repository } = await octokit.rest.repos.get({ owner, repo })
    for (const key of ['description', 'homepage']) {
      if (repository[key] === null) repository[key] = ''
    }
    for (const [key, value] of Object.entries(desired.settings || {})) {
      if (repository[key] !== base.settings?.[key] && repository[key] !== value) {
        throw new Error(`Live repository setting conflicts: ${key}`)
      }
    }
    // Re-read the PR after all slow validation reads and immediately before privileged writes.
    await getPullRequest(octokit, request)
    if (Object.entries(desired.settings || {}).some(([key, value]) => repository[key] !== value)) {
      await octokit.rest.repos.update({ owner, repo, ...desired.settings })
      const { data: updated } = await octokit.rest.repos.get({ owner, repo })
      if (
        Object.entries(desired.settings || {}).some(([key, value]) => (updated[key] ?? (['description', 'homepage'].includes(key) ? '' : undefined)) !== value)
      ) {
        throw new Error('Repository settings write was not confirmed')
      }
    }
    for (const write of resourceWrites) {
      await getPullRequest(octokit, request)
      await write()
    }
    await getPullRequest(octokit, request)
    await updateChecks?.()
  } finally {
    await octokit.rest.git.deleteRef({ owner, repo, ref: LOCK_REF })
  }
}
