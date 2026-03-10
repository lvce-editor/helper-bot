import { test, expect } from '@jest/globals'
import { addContributingSectionToReadme } from '../src/parts/AddContributingSectionToReadme/AddContributingSectionToReadme.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('adds Contributing section when missing', async () => {
  const content = `# Explorer View

Some project description.`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('README.md', clonedRepoUri).toString()]: content,
    },
  })

  const result = await addContributingSectionToReadme({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'explorer-view',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    branchName: 'feature/add-contributing-section-to-readme',
    changedFiles: [
      {
        content: `# Explorer View

Some project description.

## Contributing

\`\`\`sh
git clone git@github.com:lvce-editor/explorer-view.git &&
cd explorer-view &&
npm ci &&
npm test
\`\`\`
`,
        path: 'README.md',
      },
    ],
    commitMessage: 'feature: add contributing section to README',
    pullRequestTitle: 'feature: add contributing section to README',
    status: 'success',
    statusCode: 201,
  })
})

test('returns empty result when Contributing section already exists', async () => {
  const content = `# Explorer View

## Contributing

Already here.`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('README.md', clonedRepoUri).toString()]: content,
    },
  })

  const result = await addContributingSectionToReadme({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'explorer-view',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('handles missing README files', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await addContributingSectionToReadme({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'explorer-view',
    repositoryOwner: 'lvce-editor',
  })

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})
