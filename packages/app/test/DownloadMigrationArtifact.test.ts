import { expect, jest, test } from '@jest/globals'
import { deflateRawSync } from 'node:zlib'
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

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})

const getCrc32 = (buffer: Buffer): number => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const createZipArchive = (files: Record<string, string>): Buffer => {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name)
    const contentBuffer = Buffer.from(content)
    const compressedContent = deflateRawSync(contentBuffer)
    const crc32 = getCrc32(contentBuffer)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt32LE(crc32, 14)
    localHeader.writeUInt32LE(compressedContent.length, 18)
    localHeader.writeUInt32LE(contentBuffer.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localParts.push(localHeader, nameBuffer, compressedContent)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt32LE(crc32, 16)
    centralHeader.writeUInt32LE(compressedContent.length, 20)
    centralHeader.writeUInt32LE(contentBuffer.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, nameBuffer)
    offset += localHeader.length + nameBuffer.length + compressedContent.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0)
  endOfCentralDirectory.writeUInt16LE(Object.keys(files).length, 8)
  endOfCentralDirectory.writeUInt16LE(Object.keys(files).length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfCentralDirectory.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory])
}

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

test('reads migration result data from the manifest', async () => {
  const archive = createZipArchive({
    'manifest.json': JSON.stringify(
      {
        data: {
          releasePlan: {
            entries: [
              {
                newTag: 'v1.3.0',
                repository: 'lvce-editor/example',
                targetSha: 'main-sha',
                upgrade: true,
              },
            ],
            generatedAt: '2026-06-30T01:00:00.000Z',
            lookbackHours: 24,
            owner: 'lvce-editor',
            schemaVersion: 1,
            summary: {
              scanned: 1,
              skipped: 0,
              upgrade: 1,
            },
          },
        },
        migrationId: '/migrations2/plan-org-release-tags',
        requestId: 'request-release-plan',
        status: 'success',
        targetRepository: 'lvce-editor/helper-bot',
      },
      null,
      2,
    ),
  })
  const octokit: any = {
    rest: {
      actions: {
        downloadArtifact: async () => ({
          data: archive,
        }),
        listWorkflowRunArtifacts: async () => ({
          data: {
            artifacts: [
              {
                expired: false,
                id: 43,
                name: 'migration-result-request-release-plan',
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
    runId: 124,
  })

  expect(result?.manifest.data.releasePlan.summary).toEqual({
    scanned: 1,
    skipped: 0,
    upgrade: 1,
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
