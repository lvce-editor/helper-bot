import { expect, test } from '@jest/globals'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MigrationResult } from '../src/parts/Types/Types.ts'

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
