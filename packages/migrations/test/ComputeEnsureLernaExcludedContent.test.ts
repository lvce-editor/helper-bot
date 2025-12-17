import { test, expect } from '@jest/globals'
import { computeEnsureLernaExcludedContent } from '../src/parts/ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

test('adds lerna exclusion to ncu command', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x jest -x @jest/globals\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: content,
    },
  })

  const result = await computeEnsureLernaExcludedContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    branchName: 'feature/ensure-lerna-excluded',
    changedFiles: [
      {
        content: `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x jest -x @jest/globals -x lerna\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies`,
        path: 'scripts/update-dependencies.sh',
      },
    ],
    commitMessage: 'ci: ensure lerna is excluded from ncu commands',
    pullRequestTitle: 'ci: ensure lerna is excluded from ncu commands',
    status: 'success',
    statusCode: 200,
  })
})

test('returns same content when lerna is already excluded', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x jest -x @jest/globals -x lerna\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies`

  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: content,
    },
  })

  const result = await computeEnsureLernaExcludedContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
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

test('handles missing update-dependencies.sh script', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await computeEnsureLernaExcludedContent({
    clonedRepoUri,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
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
