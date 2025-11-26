import { test, expect } from '@jest/globals'
import * as FsPromises from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeEnsureLernaExcludedContent } from '../src/parts/ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'

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

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.mkdir(join(tempDir, 'scripts'), { recursive: true })
    await FsPromises.writeFile(
      join(tempDir, 'scripts/update-dependencies.sh'),
      content,
    )

    const result = await computeEnsureLernaExcludedContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
      exec: execa,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toHaveLength(1)
    expect(result.changedFiles[0].path).toBe('scripts/update-dependencies.sh')
    expect(result.changedFiles[0].content).toContain(
      'OUTPUT=`ncu -u -x probot -x jest -x @jest/globals -x lerna`',
    )
    expect(result.pullRequestTitle).toBe(
      'ci: ensure lerna is excluded from ncu commands',
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
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

  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    await FsPromises.mkdir(join(tempDir, 'scripts'), { recursive: true })
    await FsPromises.writeFile(
      join(tempDir, 'scripts/update-dependencies.sh'),
      content,
    )

    const result = await computeEnsureLernaExcludedContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
      exec: execa,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('handles missing update-dependencies.sh script', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-'))
  try {
    const result = await computeEnsureLernaExcludedContent({
      repositoryOwner: 'test',
      repositoryName: 'repo',
      fs: FsPromises,
      clonedRepoPath: tempDir,
      fetch: globalThis.fetch,
      exec: execa,
    })

    expect(result.status).toBe('success')
    expect(result.changedFiles).toEqual([])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
