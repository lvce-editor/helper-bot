import { test, expect, jest } from '@jest/globals'

const mockExeca = {
  execa: jest.fn(),
}

const mockFs = {
  readFile: jest.fn(),
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}

jest.unstable_mockModule('execa', () => mockExeca)
jest.unstable_mockModule('node:fs/promises', () => mockFs)
jest.unstable_mockModule('node:os', () => ({
  tmpdir: () => '/test',
}))

const { computeNewGitpodDockerfileContent } = await import(
  '../src/parts/ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
)

test('updates node version in gitpod dockerfile', async () => {
  const content = `FROM gitpod/workspace-full
RUN nvm install 18.0.0 \\
 && nvm use 18.0.0 \\
 && nvm alias default 18.0.0`

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeNewGitpodDockerfileContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('.gitpod.Dockerfile')
  expect(result.changedFiles[0].content).toContain('nvm install 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm use 20.0.0')
  expect(result.changedFiles[0].content).toContain('nvm alias default 20.0.0')
  expect(result.changedFiles[0].content).not.toContain('18.0.0')
  expect(result.pullRequestTitle).toBe('ci: update Node.js to version v20.0.0')
})

test('handles missing .gitpod.Dockerfile', async () => {
  const error = new Error('File not found')
  // @ts-ignore
  error.code = 'ENOENT'

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockRejectedValue(error)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeNewGitpodDockerfileContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    newVersion: 'v20.0.0',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
