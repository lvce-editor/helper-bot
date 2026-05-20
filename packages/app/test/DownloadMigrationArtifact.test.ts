import { expect, test } from '@jest/globals'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ArtifactManifest } from '../src/parts/DownloadMigrationArtifact/DownloadMigrationArtifact.ts'
import { getChangedFiles } from '../src/parts/DownloadMigrationArtifact/DownloadMigrationArtifact.ts'

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