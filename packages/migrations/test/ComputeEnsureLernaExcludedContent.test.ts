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

const { computeEnsureLernaExcludedContent } = await import(
  '../src/parts/ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
)

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

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeEnsureLernaExcludedContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
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

  // @ts-ignore
  mockExeca.execa.mockResolvedValue({})
  // @ts-ignore
  mockFs.mkdtemp.mockResolvedValue('/test/tmp-repo')
  // @ts-ignore
  mockFs.readFile.mockResolvedValue(content)
  // @ts-ignore
  mockFs.rm.mockResolvedValue(undefined)

  const result = await computeEnsureLernaExcludedContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})

test('handles missing update-dependencies.sh script', async () => {
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

  const result = await computeEnsureLernaExcludedContent({
    repositoryOwner: 'test',
    repositoryName: 'repo',
  })

  expect(result.status).toBe('success')
  expect(result.changedFiles).toEqual([])
})
