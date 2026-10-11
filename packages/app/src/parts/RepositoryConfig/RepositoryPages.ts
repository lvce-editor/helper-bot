export interface ManagedPages {
  readonly build_type?: 'workflow' | 'legacy'
  readonly source?: Readonly<{ branch: string; path: '/' | '/docs' }>
  readonly cname?: string | null
  readonly https_enforced?: boolean
}

export const validatePages = (value: any): void => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.keys(value).length ||
    Object.entries(value).some(([key, item]) => {
      if (key === 'build_type') return !['workflow', 'legacy'].includes(item as string)
      if (key === 'https_enforced') return typeof item !== 'boolean'
      if (key === 'cname') return item !== null && (typeof item !== 'string' || !/^[a-zA-Z0-9.-]{1,253}$/.test(item))
      if (key === 'source') {
        const source = item as any
        return (
          !source ||
          typeof source !== 'object' ||
          Array.isArray(source) ||
          Object.keys(source).some((field) => !['branch', 'path'].includes(field)) ||
          typeof source.branch !== 'string' ||
          !source.branch.length ||
          source.branch.length > 255 ||
          !['/', '/docs'].includes(source.path)
        )
      }
      return true
    })
  )
    throw new Error('Invalid Pages settings')
}

const same = (left: any, right: any): boolean =>
  typeof left === 'object' && left !== null && right !== null && typeof right === 'object'
    ? left.branch === right.branch && left.path === right.path
    : left === right

export const planPages = async (
  octokit: any,
  owner: string,
  repo: string,
  base: ManagedPages,
  desired: ManagedPages,
): Promise<readonly (() => Promise<unknown>)[]> => {
  // Existing site only: opt-in does not create/delete sites or change unmanaged custom domains.
  const { data: live } = await octokit.rest.repos.getPages({ owner, repo })
  for (const key of Object.keys(desired) as (keyof ManagedPages)[]) {
    if (!same(live[key], base[key]) && !same(live[key], desired[key])) throw new Error(`Live Pages setting conflicts: ${key}`)
  }
  if (Object.entries(desired).every(([key, value]) => same(live[key], value))) return []
  return [
    async () => {
      await octokit.rest.repos.updateInformationAboutPagesSite({ owner, repo, ...desired })
      const { data: updated } = await octokit.rest.repos.getPages({ owner, repo })
      if (Object.entries(desired).some(([key, value]) => !same(updated[key], value))) throw new Error('Pages write was not confirmed')
    },
  ]
}
