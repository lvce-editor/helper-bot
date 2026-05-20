import { beforeEach, expect, jest, test } from '@jest/globals'

const mockExtract = jest.fn<typeof import('extract-zip').default>()

const mockFs = {
  mkdtemp: jest.fn<typeof import('node:fs/promises').mkdtemp>(),
  readFile: jest.fn<typeof import('node:fs/promises').readFile>(),
  rm: jest.fn<typeof import('node:fs/promises').rm>(),
  writeFile: jest.fn<typeof import('node:fs/promises').writeFile>(),
}

jest.unstable_mockModule('extract-zip', () => ({
  default: mockExtract,
}))

jest.unstable_mockModule('node:fs/promises', () => mockFs)

jest.unstable_mockModule('node:os', () => ({
  tmpdir() {
    return '/tmp'
  },
}))

const { downloadMigrationArtifact } = await import('../src/parts/DownloadMigrationArtifact/DownloadMigrationArtifact.ts')

beforeEach(() => {
  mockExtract.mockReset()
  mockFs.mkdtemp.mockReset()
  mockFs.readFile.mockReset()
  mockFs.rm.mockReset()
  mockFs.writeFile.mockReset()

  mockFs.mkdtemp.mockResolvedValue('/tmp/migration-artifact-test')
  mockFs.writeFile.mockResolvedValue(undefined)
  mockFs.rm.mockResolvedValue(undefined)
})

test('downloads and extracts migration artifacts with extract-zip', async () => {
  const manifest = {
    baseBranch: 'main',
    branchName: 'feature/update-website-config',
    changedFiles: [
      {
        path: 'packages/website/config.json',
      },
    ],
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
        listWorkflowRunArtifacts: jest.fn().mockResolvedValue({
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
        downloadArtifact: jest.fn().mockResolvedValue({
          data: Buffer.from('artifact-bytes'),
        }),
      },
    },
  }

  mockExtract.mockResolvedValue(undefined)
  mockFs.readFile.mockImplementation(async (path) => {
    if (path === '/tmp/migration-artifact-test/artifact/manifest.json') {
      return JSON.stringify(manifest)
    }
    if (path === '/tmp/migration-artifact-test/artifact/files/packages/website/config.json') {
      return '{\n  "version": "1.0.0"\n}\n'
    }
    throw new Error(`Unexpected path: ${String(path)}`)
  })

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
  expect(mockFs.writeFile).toHaveBeenCalledWith('/tmp/migration-artifact-test/artifact.zip', Buffer.from('artifact-bytes'))
  expect(mockExtract).toHaveBeenCalledWith('/tmp/migration-artifact-test/artifact.zip', {
    dir: '/tmp/migration-artifact-test/artifact',
  })
  expect(mockFs.rm).toHaveBeenCalledWith('/tmp/migration-artifact-test', {
    force: true,
    recursive: true,
  })
})
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