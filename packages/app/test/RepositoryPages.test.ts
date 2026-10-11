import { expect, jest, test } from '@jest/globals'
import { parseConfig } from '../src/parts/RepositoryConfig/RepositoryConfig.ts'
import { assertOwnership, planResources } from '../src/parts/RepositoryConfig/RepositoryResources.ts'
import { planPages } from '../src/parts/RepositoryConfig/RepositoryPages.ts'

test.each([
  { build_type: 'other' },
  { arbitrary: true },
  { source: { branch: 'main', path: '/src' } },
  { cname: 'https://example.com' },
  { https_enforced: 'true' },
  {},
])('rejects invalid Pages data %j', (pages) => expect(() => parseConfig(JSON.stringify({ version: 1, requiredStatusChecks: ['pr'], pages }))).toThrow())

test('Pages ownership and keys require main bootstrap', () => {
  expect(() => assertOwnership({}, { pages: { build_type: 'workflow' } })).toThrow('Bootstrap')
  expect(() => assertOwnership({ pages: { build_type: 'workflow' } }, { pages: { build_type: 'workflow', cname: null } })).toThrow('Bootstrap')
})

test('missing Pages write permission fails before all resource reads/writes, even with unchanged Pages', async () => {
  const getPages = jest.fn()
  const octokit: any = { rest: { repos: { getPages } } }
  const config = { pages: { build_type: 'workflow' as const } }
  await expect(planResources(octokit, 'lvce-editor', 'about-view', config, config, { administration: 'write' })).rejects.toThrow('pages: write')
  expect(getPages).not.toHaveBeenCalled()
})

test('applies Actions source, preserves omitted fields, confirms effective state and skips duplicate applications', async () => {
  let live = { build_type: 'legacy', source: { branch: 'main', path: '/' }, cname: 'example.com', https_enforced: true }
  const getPages = jest.fn<() => Promise<any>>().mockImplementation(async () => ({ data: live }))
  const updateInformationAboutPagesSite = jest.fn<(options: any) => Promise<any>>().mockImplementation(async ({ owner: _owner, repo: _repo, ...settings }) => {
    live = { ...live, ...settings }
  })
  const octokit: any = { rest: { repos: { getPages, updateInformationAboutPagesSite } } }
  const before = { build_type: 'legacy' as const }
  const desired = { build_type: 'workflow' as const }
  const writes = await planPages(octokit, 'lvce-editor', 'about-view', before, desired)
  await writes[0]()
  expect(updateInformationAboutPagesSite).toHaveBeenCalledWith({ owner: 'lvce-editor', repo: 'about-view', build_type: 'workflow' })
  expect(live.cname).toBe('example.com')
  expect(await planPages(octokit, 'lvce-editor', 'about-view', before, desired)).toHaveLength(0)
  live.build_type = 'external'
  await expect(planPages(octokit, 'lvce-editor', 'about-view', before, desired)).rejects.toThrow('conflicts')
  live.build_type = 'legacy'
  updateInformationAboutPagesSite.mockResolvedValue({})
  await expect((await planPages(octokit, 'lvce-editor', 'about-view', before, desired))[0]()).rejects.toThrow('not confirmed')
})
