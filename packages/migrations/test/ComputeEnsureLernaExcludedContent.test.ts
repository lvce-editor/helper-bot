import { test, expect } from '@jest/globals'
import { join } from 'node:path'
import { computeEnsureLernaExcludedContent } from '../src/parts/ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'

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

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'scripts/update-dependencies.sh')]: content,
    },
  })

  const result = await computeEnsureLernaExcludedContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    fs: mockFs,
    clonedRepoPath,
    fetch: globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].path).toBe('scripts/update-dependencies.sh')
  expect(result.changedFiles[0].content).toContain('OUTPUT=`ncu -u -x probot -x jest -x @jest/globals -x lerna`')
  expect(result.pullRequestTitle).toBe('ci: ensure lerna is excluded from ncu commands')
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

  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs({
    files: {
      [join(clonedRepoPath, 'scripts/update-dependencies.sh')]: content,
    },
  })

  const result = await computeEnsureLernaExcludedContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    fs: mockFs,
    clonedRepoPath,
    fetch: globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles missing update-dependencies.sh script', async () => {
  const clonedRepoPath = '/test/repo'
  const mockFs = createMockFs()

  const result = await computeEnsureLernaExcludedContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
    fs: mockFs,
    clonedRepoPath,
    fetch: globalThis.fetch,
    exec: mockExec,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
