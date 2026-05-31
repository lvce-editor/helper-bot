import { expect, jest, test } from '@jest/globals'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ArtifactManifest } from '../src/parts/DownloadMigrationArtifact/DownloadMigrationArtifact.ts'
import { downloadMigrationArtifact, getChangedFiles } from '../src/parts/DownloadMigrationArtifact/DownloadMigrationArtifact.ts'

const migrationArtifactArchive = Buffer.from(
  [
    'UEsDBBQAAAAIAHZ9tFxNYeveqgAAADwBAAANAAAAbWFuaWZlc3QuanNvbo1Ouw7CQAz7lepm2gpGRjYG',
    'GBA/kF7TI9I9yiUHQoh/JxSEuiAxxXbsOHfTAeMmQ7QnszYBKJqF6Sa+h4CqDQhSMrZl7EGwvmLHpNOm',
    'OJBTs00hkOyQGdzMv67egeoTqL6BQC6DUIrbXu3tl/LqZ8dYvD/guSDLkcT/VZPf/qnkg+ul6iwaZBW5',
    'WKtfqySQHcoBx6QnUr7p0l8s1ti/aDvDjSM5la6hZB5PUEsDBBQAAAAIAHZ9tFz2WnB9GwAAABkAAAAi',
    'AAAAZmlsZXMvcGFja2FnZXMvd2Vic2l0ZS9jb25maWcuanNvbqvmUlBQKkstKs7Mz1OyUlAy1DPQM1Di',
    'quUCAFBLAQIUAxQAAAAIAHZ9tFxNYeveqgAAADwBAAANAAAAAAAAAAAAAACkgQAAAABtYW5pZmVzdC5q',
    'c29uUEsBAhQDFAAAAAgAdn20XPZacH0bAAAAGQAAACIAAAAAAAAAAAAAAKSB1QAAAGZpbGVzL3BhY2th',
    'Z2VzL3dlYnNpdGUvY29uZmlnLmpzb25QSwUGAAAAAAIAAgCLAAAAMAEAAAAA',
  ].join(''),
  'base64',
)

test('downloads and extracts migration artifacts with unzip', async () => {
  const manifest = {
    baseBranch: 'main',
    branchName: 'feature/update-website-config',
    commitMessage: 'feature: update website config',
    migrationId: '/migrations2/update-website-config',
    pullRequestTitle: 'feature: update website config',
    requestId: 'request-1',
    status: 'success' as const,
    targetRepository: 'lvce-editor/lvce-editor.github.io',
  }
  const octokit: any = {
    rest: {
      actions: {
        downloadArtifact: async () => ({
          data: migrationArtifactArchive,
        }),
        listWorkflowRunArtifacts: async () => ({
          data: {
            artifacts: [
              {
                expired: false,
                id: 42,
                name: 'migration-result-request-1',
              },
            ],
          },
        }),
      },
    },
  }

  const result = await downloadMigrationArtifact({
    octokit,
    owner: 'lvce-editor',
    repo: 'helper-bot',
    runId: 123,
  })

  expect(result).toEqual({
    changedFiles: [
      {
        content: '{\n  "version": "1.0.0"\n}\n',
        path: 'packages/website/config.json',
      },
    ],
    manifest,
  })
})

test('downloads the newest migration artifact for the workflow run', async () => {
  const downloadArtifact = jest.fn(async () => ({
    data: migrationArtifactArchive,
  }))
  const octokit: any = {
    rest: {
      actions: {
        downloadArtifact,
        listWorkflowRunArtifacts: async () => ({
          data: {
            artifacts: [
              {
                created_at: '2026-05-31T10:00:00Z',
                expired: false,
                id: 41,
                name: 'migration-result-old-request',
                updated_at: '2026-05-31T10:00:00Z',
              },
              {
                created_at: '2026-05-31T10:01:00Z',
                expired: false,
                id: 42,
                name: 'migration-result-new-request',
                updated_at: '2026-05-31T10:01:00Z',
              },
            ],
          },
        }),
      },
    },
  }

  await downloadMigrationArtifact({
    octokit,
    owner: 'lvce-editor',
    repo: 'helper-bot',
    runId: 123,
  })

  expect(downloadArtifact).toHaveBeenCalledWith({
    archive_format: 'zip',
    artifact_id: 42,
    owner: 'lvce-editor',
    repo: 'helper-bot',
    request: {
      timeout: 20_000,
    },
  })
})

test('reconstructs changed files from the files directory and deleted file metadata', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'download-migration-artifact-'))
  try {
    await mkdir(join(artifactRoot, 'files', 'src'), { recursive: true })
    await writeFile(join(artifactRoot, 'files', 'package.json'), '{\n  "name": "example"\n}\n')
    await writeFile(join(artifactRoot, 'files', 'src', 'index.ts'), 'export const value = 1\n')
    const manifest: ArtifactManifest = {
      deletedFiles: ['.gitpod.yml'],
      migrationId: '/migrations2/update-website-config',
      requestId: 'request-1',
      status: 'success',
      targetRepository: 'lvce-editor/example-repo',
    }

    const changedFiles = await getChangedFiles(artifactRoot, manifest)

    expect(changedFiles).toEqual([
      {
        content: '{\n  "name": "example"\n}\n',
        path: 'package.json',
      },
      {
        content: 'export const value = 1\n',
        path: 'src/index.ts',
      },
      {
        content: '',
        path: '.gitpod.yml',
        type: 'deleted',
      },
    ])
  } finally {
    await rm(artifactRoot, { force: true, recursive: true })
  }
})

test('returns deleted files when the artifact has no files directory', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'download-migration-artifact-'))
  try {
    const manifest: ArtifactManifest = {
      deletedFiles: ['.gitpod.yml'],
      migrationId: '/migrations2/remove-gitpod-yml',
      requestId: 'request-2',
      status: 'success',
      targetRepository: 'lvce-editor/example-repo',
    }

    const changedFiles = await getChangedFiles(artifactRoot, manifest)

    expect(changedFiles).toEqual([
      {
        content: '',
        path: '.gitpod.yml',
        type: 'deleted',
      },
    ])
  } finally {
    await rm(artifactRoot, { force: true, recursive: true })
  }
})
