import { jest, test, expect } from '@jest/globals'
import nock from 'nock'

const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
}

jest.unstable_mockModule('node:fs/promises', () => mockFs)

const { updateNodeVersion } = await import('../src/updateNodeVersion.js')

test('updates node version in files', async () => {
  mockFs.readFile.mockImplementation((path) => {
    // @ts-ignore
    if (path.endsWith('.nvmrc')) {
      return 'v18.0.0'
    }
    // @ts-ignore
    if (path.endsWith('Dockerfile')) {
      return 'FROM node:18.0.0\nWORKDIR /app'
    }
    // @ts-ignore
    if (path.endsWith('gitpod.Dockerfile')) {
      return 'FROM gitpod/workspace-full\nRUN nvm install 18.0.0'
    }
    throw new Error('File not found')
  })

  const mock = nock('https://nodejs.org')
    .get('/dist/index.json')
    .reply(200, [
      {
        version: 'v22.0.0',
        lts: false,
      },
      {
        version: 'v20.0.0',
        lts: 'Iron',
      },
      {
        version: 'v18.0.0',
        lts: 'Hydrogen',
      },
    ])

  await updateNodeVersion({
    owner: 'lvce-editor',
    repo: 'test-repo',
    octokit: {} as any,
  })

  expect(mockFs.writeFile).toHaveBeenNthCalledWith(1, '.nvmrc', 'v20.0.0\n')
  expect(mockFs.writeFile).toHaveBeenNthCalledWith(
    2,
    'Dockerfile',
    'FROM node:20.0.0\nWORKDIR /app',
  )
  // expect(mockFs.writeFile).toHaveBeenNthCalledWith(
  //   3,
  //   'gitpod.Dockerfile',
  //   'FROM gitpod/workspace-full\nRUN nvm install 22.0.0',
  // )
  expect(mock.isDone()).toBe(true)
})
