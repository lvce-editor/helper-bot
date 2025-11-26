import { test, expect } from '@jest/globals'
import { computeEnsureLernaExcludedContent } from '../src/parts/ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'

test('adds lerna exclusion to ncu command', () => {
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

  const result = computeEnsureLernaExcludedContent({ currentContent: content })

  expect(result.hasChanges).toBe(true)
  expect(result.newContent).toContain(
    'OUTPUT=`ncu -u -x probot -x jest -x @jest/globals -x lerna`',
  )
})

test('returns same content when lerna is already excluded', () => {
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

  const result = computeEnsureLernaExcludedContent({ currentContent: content })

  expect(result.hasChanges).toBe(false)
  expect(result.newContent).toBe(content)
})

test('handles script without ncu command', () => {
  const content = `#!/bin/bash

echo "This script does not contain ncu command"
echo "It just does some other stuff"`

  const result = computeEnsureLernaExcludedContent({ currentContent: content })

  expect(result.hasChanges).toBe(false)
  expect(result.newContent).toBe(content)
})

test('handles ncu command with no exclusions', () => {
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

  const result = computeEnsureLernaExcludedContent({ currentContent: content })

  expect(result.hasChanges).toBe(true)
  expect(result.newContent).toContain('OUTPUT=`ncu -u -x lerna`')
})

test('handles multiple ncu commands', () => {
  const content = `#!/bin/bash

function updateDependencies {
  OUTPUT=\`ncu -u -x probot\`
  echo "Updated"
  OUTPUT=\`ncu -u -x jest\`
}

updateDependencies`

  const result = computeEnsureLernaExcludedContent({ currentContent: content })

  expect(result.hasChanges).toBe(true)
  expect(result.newContent).toContain('OUTPUT=`ncu -u -x probot -x lerna`')
  expect(result.newContent).toContain('OUTPUT=`ncu -u -x jest -x lerna`')
})

test('handles empty content', () => {
  const result = computeEnsureLernaExcludedContent({ currentContent: '' })

  expect(result.hasChanges).toBe(false)
  expect(result.newContent).toBe('')
})
