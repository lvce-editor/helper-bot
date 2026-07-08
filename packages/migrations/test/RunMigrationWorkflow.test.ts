import { expect, jest, test } from '@jest/globals'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MigrationResult } from '../src/parts/Types/Types.ts'

jest.setTimeout(20_000)

const createInvokeMigration = (calls: Array<[string, Record<string, any>]>) => {
  return async (migrationId: string, options: Record<string, any>): Promise<MigrationResult> => {
    calls.push([migrationId, options])
    return {
      branchName: 'feature/update-website-config',
      changedFiles: [
        {
          content: '{\n  "version": "1.0.0"\n}\n',
          path: 'packages/website/config.json',
        },
      ],
      commitMessage: 'feature: update website config',
      pullRequestTitle: 'feature: update website config',
      status: 'success',
      statusCode: 200,
    }
  }
}

const invokeDeletionMigration = async (): Promise<MigrationResult> => {
  return {
    branchName: 'feature/remove-gitpod-yml',
    changedFiles: [
      {
        content: '',
        path: '.gitpod.yml',
        type: 'deleted',
      },
    ],
    commitMessage: 'ci: remove .gitpod.yml',
    pullRequestTitle: 'ci: remove .gitpod.yml',
    status: 'success',
    statusCode: 200,
  }
}

test('writes a manifest and changed files for a successful migration run', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'run-migration-workflow-'))
  const calls: Array<[string, Record<string, any>]> = []
  const invokeMigration = createInvokeMigration(calls)

  const { runMigrationWorkflow } = await import('../src/parts/RunMigrationWorkflow/RunMigrationWorkflow.ts')
  await runMigrationWorkflow({
    baseBranch: 'main',
    invokeMigration,
    migrationId: '/migrations2/update-website-config',
    migrationOptionsJson: '{"releasedTag":"v1.0.0"}',
    outputDir,
    requestId: 'request-1',
    targetRepository: 'lvce-editor/lvce-editor.github.io',
  })

  const manifestContent = await readFile(join(outputDir, 'manifest.json'), 'utf8')
  const fileContent = await readFile(join(outputDir, 'files', 'packages', 'website', 'config.json'), 'utf8')

  expect(JSON.parse(manifestContent)).toEqual({
    baseBranch: 'main',
    branchName: 'feature/update-website-config',
    commitMessage: 'feature: update website config',
    migrationId: '/migrations2/update-website-config',
    pullRequestTitle: 'feature: update website config',
    requestId: 'request-1',
    status: 'success',
    targetRepository: 'lvce-editor/lvce-editor.github.io',
  })
  expect(fileContent).toBe('{\n  "version": "1.0.0"\n}\n')
  expect(calls).toEqual([
    [
      '/migrations2/update-website-config',
      {
        releasedTag: 'v1.0.0',
        repositoryName: 'lvce-editor.github.io',
        repositoryOwner: 'lvce-editor',
      },
    ],
  ])
})

test('writes deleted file paths to the manifest without creating file entries', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'run-migration-workflow-'))

  const { runMigrationWorkflow } = await import('../src/parts/RunMigrationWorkflow/RunMigrationWorkflow.ts')
  await runMigrationWorkflow({
    invokeMigration: invokeDeletionMigration,
    migrationId: '/migrations2/remove-gitpod-yml',
    outputDir,
    requestId: 'request-2',
    targetRepository: 'lvce-editor/example-repo',
  })

  const manifestContent = await readFile(join(outputDir, 'manifest.json'), 'utf8')

  expect(JSON.parse(manifestContent)).toEqual({
    branchName: 'feature/remove-gitpod-yml',
    commitMessage: 'ci: remove .gitpod.yml',
    deletedFiles: ['.gitpod.yml'],
    migrationId: '/migrations2/remove-gitpod-yml',
    pullRequestTitle: 'ci: remove .gitpod.yml',
    requestId: 'request-2',
    status: 'success',
    targetRepository: 'lvce-editor/example-repo',
  })
})

test('writes repo commands to the manifest', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'run-migration-workflow-'))

  const { runMigrationWorkflow } = await import('../src/parts/RunMigrationWorkflow/RunMigrationWorkflow.ts')
  await runMigrationWorkflow({
    invokeMigration: async (): Promise<MigrationResult> => {
      return {
        changedFiles: [],
        data: {
          branch: 'main',
          message: 'Queued branch protection modernization',
        },
        pullRequestTitle: '',
        repoCommands: [
          {
            branch: 'main',
            type: 'modernize-branch-protection',
          },
        ],
        status: 'success',
        statusCode: 200,
      }
    },
    migrationId: '/migrations2/modernize-branch-protection',
    outputDir,
    requestId: 'request-commands',
    targetRepository: 'lvce-editor/example-repo',
  })

  const manifestContent = await readFile(join(outputDir, 'manifest.json'), 'utf8')

  expect(JSON.parse(manifestContent)).toEqual({
    data: {
      branch: 'main',
      message: 'Queued branch protection modernization',
    },
    migrationId: '/migrations2/modernize-branch-protection',
    repoCommands: [
      {
        branch: 'main',
        type: 'modernize-branch-protection',
      },
    ],
    requestId: 'request-commands',
    status: 'success',
    targetRepository: 'lvce-editor/example-repo',
  })
})

test('writes update branch protection checks commands to the manifest', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'run-migration-workflow-'))

  const { runMigrationWorkflow } = await import('../src/parts/RunMigrationWorkflow/RunMigrationWorkflow.ts')
  await runMigrationWorkflow({
    invokeMigration: async (): Promise<MigrationResult> => {
      return {
        changedFiles: [
          {
            content: 'runs-on: macos-26\n',
            path: '.github/workflows/pr.yml',
          },
        ],
        commitMessage: 'feature: update runner versions',
        pullRequestTitle: 'feature: update runner versions',
        repoCommands: [
          {
            branch: 'main',
            osVersions: {
              macos: '26',
              ubuntu: '24.04',
              windows: '2025',
            },
            type: 'update-branch-protection-checks',
          },
        ],
        status: 'success',
        statusCode: 201,
      }
    },
    migrationId: '/migrations2/update-ci-versions',
    outputDir,
    requestId: 'request-ci-versions',
    targetRepository: 'lvce-editor/example-repo',
  })

  const manifestContent = await readFile(join(outputDir, 'manifest.json'), 'utf8')

  expect(JSON.parse(manifestContent)).toEqual({
    commitMessage: 'feature: update runner versions',
    migrationId: '/migrations2/update-ci-versions',
    pullRequestTitle: 'feature: update runner versions',
    repoCommands: [
      {
        branch: 'main',
        osVersions: {
          macos: '26',
          ubuntu: '24.04',
          windows: '2025',
        },
        type: 'update-branch-protection-checks',
      },
    ],
    requestId: 'request-ci-versions',
    status: 'success',
    targetRepository: 'lvce-editor/example-repo',
  })
})

test('writes dry run metadata to the manifest', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'run-migration-workflow-'))
  const calls: Array<[string, Record<string, any>]> = []
  const invokeMigration = createInvokeMigration(calls)

  const { runMigrationWorkflow } = await import('../src/parts/RunMigrationWorkflow/RunMigrationWorkflow.ts')
  await runMigrationWorkflow({
    dryRun: true,
    invokeMigration,
    migrationId: '/migrations2/update-website-config',
    outputDir,
    requestId: 'request-dry-run',
    targetRepository: 'lvce-editor/lvce-editor.github.io',
  })

  const manifestContent = await readFile(join(outputDir, 'manifest.json'), 'utf8')

  expect(JSON.parse(manifestContent)).toMatchObject({
    dryRun: true,
    migrationId: '/migrations2/update-website-config',
    requestId: 'request-dry-run',
    status: 'success',
    targetRepository: 'lvce-editor/lvce-editor.github.io',
  })
})

test('writes release plan repository summary arrays to the manifest', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'run-migration-workflow-'))

  const { runMigrationWorkflow } = await import('../src/parts/RunMigrationWorkflow/RunMigrationWorkflow.ts')
  await runMigrationWorkflow({
    invokeMigration: async (): Promise<MigrationResult> => {
      return {
        changedFiles: [],
        data: {
          releasePlan: {
            entries: [
              {
                repository: 'lvce-editor/prettier',
                upgrade: true,
              },
              {
                nonUpgradeReason: 'no recent commits',
                repository: 'lvce-editor/theme-ayu',
                upgrade: false,
              },
              {
                repository: 'lvce-editor/git',
                upgrade: true,
              },
            ],
            generatedAt: '2026-06-30T01:00:00.000Z',
            lookbackHours: 24,
            owner: 'lvce-editor',
            schemaVersion: 1,
            summary: {
              scanned: 3,
              skipped: 1,
              upgrade: 2,
            },
          },
        },
        pullRequestTitle: 'plan-org-release-tags',
        status: 'success',
        statusCode: 200,
      }
    },
    migrationId: '/migrations2/plan-org-release-tags',
    outputDir,
    requestId: 'request-release-plan',
    targetRepository: 'lvce-editor/helper-bot',
  })

  const manifestContent = await readFile(join(outputDir, 'manifest.json'), 'utf8')
  const manifest = JSON.parse(manifestContent)

  expect(Object.keys(manifest).at(0)).toBe('repositoriesToUpgrade')
  expect(Object.keys(manifest).at(-1)).toBe('repositoriesNotToUpgrade')
  expect(manifest.repositoriesToUpgrade).toEqual(['lvce-editor/prettier', 'lvce-editor/git'])
  expect(manifest.repositoriesNotToUpgrade).toEqual(['lvce-editor/theme-ayu'])
  expect(manifest.repositoriesToUpgrade).toEqual(
    manifest.data.releasePlan.entries.filter((entry: any) => entry.upgrade === true).map((entry: any) => entry.repository),
  )
  expect(manifest.repositoriesNotToUpgrade).toEqual(
    manifest.data.releasePlan.entries.filter((entry: any) => entry.upgrade !== true).map((entry: any) => entry.repository),
  )
})

test('writes an error manifest when the target repository is outside lvce-editor', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'run-migration-workflow-'))

  const { runMigrationWorkflow } = await import('../src/parts/RunMigrationWorkflow/RunMigrationWorkflow.ts')
  const result = await runMigrationWorkflow({
    invokeMigration: async (): Promise<MigrationResult> => {
      throw new Error('should not run')
    },
    migrationId: '/migrations2/update-website-config',
    outputDir,
    requestId: 'request-3',
    targetRepository: 'other-org/example-repo',
  })

  const manifestContent = await readFile(join(outputDir, 'manifest.json'), 'utf8')

  expect(result).toEqual({
    changedFiles: [],
    errorMessage: 'Target repository must belong to lvce-editor',
    status: 'error',
    statusCode: 500,
  })
  expect(JSON.parse(manifestContent)).toEqual({
    errorMessage: 'Target repository must belong to lvce-editor',
    migrationId: '/migrations2/update-website-config',
    requestId: 'request-3',
    status: 'error',
    targetRepository: 'other-org/example-repo',
  })
})
