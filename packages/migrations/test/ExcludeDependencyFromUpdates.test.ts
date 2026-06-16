import { test, expect } from '@jest/globals'
import { createMockExec } from '../src/parts/CreateMockExec/CreateMockExec.ts'
import { createMockFs } from '../src/parts/CreateMockFs/CreateMockFs.ts'
import { excludeDependencyFromUpdates } from '../src/parts/ExcludeDependencyFromUpdates/ExcludeDependencyFromUpdates.ts'
import { pathToUri } from '../src/parts/UriUtils/UriUtils.ts'

const mockExec = createMockExec()

const createOptions = (content: string, dependencyName = '@babel/plugin-typescript'): Parameters<typeof excludeDependencyFromUpdates>[0] => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs({
    files: {
      [new URL('scripts/update-dependencies.sh', clonedRepoUri).toString()]: content,
    },
  })

  return {
    clonedRepoUri,
    dependencyName,
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: mockFs,
    repositoryName: 'repo',
    repositoryOwner: 'test',
  }
}

test('adds dependency exclusion to ncu command', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x lerna\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies`

  const result = await excludeDependencyFromUpdates(createOptions(content))

  expect(result).toEqual({
    branchName: 'feature/exclude-babel-plugin-typescript-from-updates',
    changedFiles: [
      {
        content: `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x lerna -x @babel/plugin-typescript\`
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
    commitMessage: 'ci: exclude @babel/plugin-typescript from dependency updates',
    pullRequestTitle: 'ci: exclude @babel/plugin-typescript from dependency updates',
    status: 'success',
    statusCode: 201,
  })
})

test('adds dependency exclusion when no exclusions exist', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  OUTPUT=\`ncu -u\`
}
`

  const result = await excludeDependencyFromUpdates(createOptions(content, 'typescript'))

  expect(result).toEqual({
    branchName: 'feature/exclude-typescript-from-updates',
    changedFiles: [
      {
        content: `#!/bin/bash

function updateDependencies {
  OUTPUT=\`ncu -u -x typescript\`
}
`,
        path: 'scripts/update-dependencies.sh',
      },
    ],
    commitMessage: 'ci: exclude typescript from dependency updates',
    pullRequestTitle: 'ci: exclude typescript from dependency updates',
    status: 'success',
    statusCode: 201,
  })
})

test('returns empty result when dependency is already excluded', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  OUTPUT=\`ncu -u -x @babel/plugin-typescript -x probot\`
}
`

  const result = await excludeDependencyFromUpdates(createOptions(content))

  expect(result).toEqual({
    branchName: '',
    changedFiles: [],
    commitMessage: '',
    pullRequestTitle: '',
    status: 'success',
    statusCode: 200,
  })
})

test('does not treat partial dependency name matches as already excluded', async () => {
  const content = `#!/bin/bash

function updateDependencies {
  OUTPUT=\`ncu -u -x @babel/plugin-typescript-eslint\`
}
`

  const result = await excludeDependencyFromUpdates(createOptions(content))

  expect(result).toEqual({
    branchName: 'feature/exclude-babel-plugin-typescript-from-updates',
    changedFiles: [
      {
        content: `#!/bin/bash

function updateDependencies {
  OUTPUT=\`ncu -u -x @babel/plugin-typescript-eslint -x @babel/plugin-typescript\`
}
`,
        path: 'scripts/update-dependencies.sh',
      },
    ],
    commitMessage: 'ci: exclude @babel/plugin-typescript from dependency updates',
    pullRequestTitle: 'ci: exclude @babel/plugin-typescript from dependency updates',
    status: 'success',
    statusCode: 201,
  })
})

test('handles missing update-dependencies.sh script', async () => {
  const clonedRepoUri = pathToUri('/test/repo')
  const mockFs = createMockFs()

  const result = await excludeDependencyFromUpdates({
    clonedRepoUri,
    dependencyName: '@babel/plugin-typescript',
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

test('validates dependencyName parameter', async () => {
  const result = await excludeDependencyFromUpdates({
    clonedRepoUri: pathToUri('/test/repo'),
    dependencyName: '',
    exec: mockExec,
    fetch: globalThis.fetch,
    fs: createMockFs(),
    repositoryName: 'repo',
    repositoryOwner: 'test',
  })

  expect(result).toEqual({
    changedFiles: [],
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Invalid or missing dependencyName parameter',
    status: 'error',
    statusCode: 400,
  })
})
