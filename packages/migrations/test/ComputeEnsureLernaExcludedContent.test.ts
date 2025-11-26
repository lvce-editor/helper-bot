import { test, expect } from '@jest/globals'
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

  const result = await computeEnsureLernaExcludedContent({
    repository: 'test/repo',
    currentContent: content,
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

  const result = await computeEnsureLernaExcludedContent({
    repository: 'test/repo',
    currentContent: content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles script without ncu command', async () => {
  const content = `#!/bin/bash

echo "This script does not contain ncu command"
echo "It just does some other stuff"`

  const result = await computeEnsureLernaExcludedContent({
    repository: 'test/repo',
    currentContent: content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles ncu command with no exclusions', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies`

  const result = await computeEnsureLernaExcludedContent({
    repository: 'test/repo',
    currentContent: content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain('OUTPUT=`ncu -u -x lerna`')
})

test('handles multiple ncu commands', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  OUTPUT=\`ncu -u -x probot\`
  echo "Updated"
  OUTPUT=\`ncu -u -x jest\`
}

updateDependencies`

  const result = await computeEnsureLernaExcludedContent({
    repository: 'test/repo',
    currentContent: content,
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toHaveLength(1)
  expect(result.changedFiles[0].content).toContain(
    'OUTPUT=`ncu -u -x probot -x lerna`',
  )
  expect(result.changedFiles[0].content).toContain(
    'OUTPUT=`ncu -u -x jest -x lerna`',
  )
})

test('handles empty content', async () => {
  const result = await computeEnsureLernaExcludedContent({
    repository: 'test/repo',
    currentContent: '',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
