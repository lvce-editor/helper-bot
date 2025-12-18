import { expect, test } from '@jest/globals'
import type { BaseMigrationOptions } from '../src/parts/Types/Types.ts'
import { createPrereleaseBeforeRelease } from '../src/parts/CreatePrereleaseBeforeRelease/CreatePrereleaseBeforeRelease.ts'

const createMockOptions = (fileExists: boolean, fileContent: string): BaseMigrationOptions => {
  return {
    clonedRepoUri: 'file:///tmp/repo',
    exec: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
    fetch: fetch,
    fs: {
      exists: async () => fileExists,
      readFile: async () => fileContent,
    } as any,
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
  }
}

test('returns empty result when release.yml does not exist', async (): Promise<void> => {
  const options = createMockOptions(false, '')

  const result = await createPrereleaseBeforeRelease(options)

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('returns empty result when draft is already present', async (): Promise<void> => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'
jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04
    steps:
      - name: Create GitHub release
        id: release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ env.RG_VERSION }}
          name: \${{ env.RG_VERSION }}
          draft: true

  build-release:
    name: build-release
    runs-on: ubuntu-24.04
    steps:
      - run: npm test
      - name: Publish GitHub release
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="\${{ needs.create-release.outputs.rg_version }}"
          gh release edit $VERSION --draft=false
`

  const options = createMockOptions(true, content)

  const result = await createPrereleaseBeforeRelease(options)

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('adds draft: true to create release step', async (): Promise<void> => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'
jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04
    outputs:
      upload_url: \${{ steps.release.outputs.upload_url }}
      rg_version: \${{ env.RG_VERSION }}
    steps:
      - name: Get the release version from the tag
        shell: bash
        if: env.RG_VERSION == ''
        run: |
          echo "RG_VERSION=\${GITHUB_REF#refs/tags/}" >> $GITHUB_ENV
          echo "version is: \${{ env.RG_VERSION }}"
      - name: Create GitHub release
        id: release
        uses: softprops/action-gh-release@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: \${{ env.RG_VERSION }}
          name: \${{ env.RG_VERSION }}

  build-release:
    name: build-release
    needs: ['create-release']
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - run: npm test
`

  const options = createMockOptions(true, content)

  const result = await createPrereleaseBeforeRelease(options)

  expect(result).toEqual({
    branchName: 'feature/create-prerelease-before-release',
    changedFiles: [
      {
        content: expect.any(String),
        path: '.github/workflows/release.yml',
      },
    ],
    commitMessage: 'feature: create prerelease before final release',
    pullRequestTitle: 'feature: create prerelease before final release',
    status: 'success',
    statusCode: 201,
  })

  const updatedContent = result.changedFiles[0].content

  // Check that draft: true was added
  expect(updatedContent).toContain('draft: true')

  // Check that publish release step was added
  expect(updatedContent).toContain('Publish GitHub release')
  expect(updatedContent).toContain('gh release edit $VERSION --draft=false')
})

test('adds publish release step when missing', async (): Promise<void> => {
  const content = `name: release
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'
jobs:
  create-release:
    name: create-release
    runs-on: ubuntu-24.04
    steps:
      - name: Create GitHub release
        id: release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ env.RG_VERSION }}
          name: \${{ env.RG_VERSION }}
          draft: true

  build-release:
    name: build-release
    runs-on: ubuntu-24.04
    steps:
      - run: npm test
`

  const options = createMockOptions(true, content)

  const result = await createPrereleaseBeforeRelease(options)

  expect(result).toEqual({
    branchName: 'feature/create-prerelease-before-release',
    changedFiles: [
      {
        content: expect.any(String),
        path: expect.any(String),
      },
    ],
    commitMessage: 'feature: create prerelease before final release',
    pullRequestTitle: 'feature: create prerelease before final release',
    status: 'success',
    statusCode: 201,
  })

  const updatedContent = result.changedFiles[0].content

  // Check that publish release step was added
  expect(updatedContent).toContain('Publish GitHub release')
  expect(updatedContent).toContain('gh release edit $VERSION --draft=false')
  expect(updatedContent).toContain('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}')
})

test('preserves correct indentation', async (): Promise<void> => {
  const content = `name: release
jobs:
  create-release:
    steps:
      - name: Create GitHub release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ env.VERSION }}

  build-release:
    steps:
      - run: npm test
`

  const options = createMockOptions(true, content)

  const result = await createPrereleaseBeforeRelease(options)

  expect(result).toEqual({
    branchName: 'feature/create-prerelease-before-release',
    changedFiles: expect.any(Array),
    commitMessage: 'feature: create prerelease before final release',
    pullRequestTitle: 'feature: create prerelease before final release',
    status: 'success',
    statusCode: 201,
  })

  const updatedContent = result.changedFiles[0].content
  const lines = updatedContent.split('\n')

  // Find the draft line and check its indentation
  const draftLine = lines.find((line) => line.includes('draft: true'))
  expect(draftLine).toBeDefined()
  expect(draftLine).toMatch(/^ {10}draft: true/)

  // Find the publish step and check its indentation
  const publishLine = lines.find((line) => line.includes('Publish GitHub release'))
  expect(publishLine).toBeDefined()
  expect(publishLine).toMatch(/^ {6}- name: Publish GitHub release/)
})
