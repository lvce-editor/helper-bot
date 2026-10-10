export interface ManagedBranch {
  readonly name: string
  readonly protection: {
    readonly enforce_admins?: boolean
    readonly required_signatures?: boolean
    readonly required_pull_request_reviews?: Readonly<{
      required_approving_review_count?: number
      dismiss_stale_reviews?: boolean
      require_code_owner_reviews?: boolean
      require_last_push_approval?: boolean
    }>
  }
}

const sameKeys = (left: object, right: object): boolean => JSON.stringify(Object.keys(left).sort()) === JSON.stringify(Object.keys(right).sort())
const reviews = ['required_approving_review_count', 'dismiss_stale_reviews', 'require_code_owner_reviews', 'require_last_push_approval']
export const validateBranches = (branches: any): void => {
  if (!Array.isArray(branches) || branches.length > 100) throw new Error('Invalid branches')
  const names = new Set<string>()
  for (const branch of branches) {
    if (
      !branch ||
      Object.keys(branch).some((key) => !['name', 'protection'].includes(key)) ||
      typeof branch.name !== 'string' ||
      !/^[a-zA-Z0-9_./-]{1,255}$/.test(branch.name) ||
      branch.name.includes('..') ||
      names.has(branch.name)
    )
      throw new Error('Invalid branch identity')
    names.add(branch.name)
    const protection = branch.protection
    if (!protection || Array.isArray(protection) || typeof protection !== 'object' || !Object.keys(protection).length)
      throw new Error('Invalid branch protection')
    for (const [key, value] of Object.entries(protection)) {
      if (['enforce_admins', 'required_signatures'].includes(key)) {
        if (typeof value !== 'boolean') throw new Error('Invalid branch protection flag')
      } else if (key === 'required_pull_request_reviews') {
        if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) throw new Error('Invalid review protection')
        for (const [field, setting] of Object.entries(value)) {
          if (
            !reviews.includes(field) ||
            (field === 'required_approving_review_count'
              ? !Number.isInteger(setting) || (setting as number) < 0 || (setting as number) > 6
              : typeof setting !== 'boolean')
          )
            throw new Error('Invalid review protection field')
        }
      } else throw new Error(`Unsupported branch protection: ${key}`)
    }
  }
}

export const assertBranchOwnership = (base: readonly ManagedBranch[], desired: readonly ManagedBranch[]): void => {
  if (base.length !== desired.length) throw new Error('Bootstrap branch ownership on main first')
  for (const branch of desired) {
    const before = base.find((item) => item.name === branch.name)
    if (
      !before ||
      !sameKeys(before.protection, branch.protection) ||
      !sameKeys(before.protection.required_pull_request_reviews || {}, branch.protection.required_pull_request_reviews || {})
    )
      throw new Error('Bootstrap branch ownership on main first')
  }
}

export const planBranches = async (
  octokit: any,
  owner: string,
  repo: string,
  base: readonly ManagedBranch[],
  desired: readonly ManagedBranch[],
): Promise<readonly (() => Promise<unknown>)[]> => {
  const writes: (() => Promise<unknown>)[] = []
  for (const branch of desired) {
    const before = base.find((item) => item.name === branch.name)!
    const params = { owner, repo, branch: branch.name }
    const { data: live } = await octokit.rest.repos.getBranchProtection(params)
    const check = (current: unknown, old: unknown, next: unknown, field: string): boolean => {
      if (current !== old && current !== next) throw new Error(`Live branch protection conflicts: ${branch.name}/${field}`)
      return current !== next
    }
    for (const key of ['enforce_admins', 'required_signatures'] as const) {
      const next = branch.protection[key]
      if (next === undefined) continue
      const current = live[key]?.enabled ?? false
      if (check(current, before.protection[key], next, key)) {
        writes.push(async () => {
          if (key === 'enforce_admins') {
            if (next) await octokit.rest.repos.setAdminBranchProtection(params)
            else await octokit.rest.repos.deleteAdminBranchProtection(params)
          } else {
            if (next) await octokit.rest.repos.createCommitSignatureProtection(params)
            else await octokit.rest.repos.deleteCommitSignatureProtection(params)
          }
          const { data } = await octokit.rest.repos.getBranchProtection(params)
          if ((data[key]?.enabled ?? false) !== next) throw new Error(`Branch protection write was not confirmed: ${key}`)
        })
      }
    }
    const update: Record<string, unknown> = {}
    for (const [key, next] of Object.entries(branch.protection.required_pull_request_reviews || {})) {
      // Refuse to create review protection via the partial endpoint; bootstrap it explicitly.
      if (!live.required_pull_request_reviews) throw new Error('Bootstrap review protection before managing it')
      if (
        check(
          live.required_pull_request_reviews[key],
          (before.protection.required_pull_request_reviews as Readonly<Record<string, unknown>> | undefined)?.[key],
          next,
          key,
        )
      )
        update[key] = next
    }
    if (Object.keys(update).length)
      writes.push(async () => {
        await octokit.rest.repos.updatePullRequestReviewProtection({ ...params, ...update })
        const { data } = await octokit.rest.repos.getBranchProtection(params)
        if (Object.entries(update).some(([key, next]) => data.required_pull_request_reviews?.[key] !== next))
          throw new Error('Review protection write was not confirmed')
      })
  }
  return writes
}
