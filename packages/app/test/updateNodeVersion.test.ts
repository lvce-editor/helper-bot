import { jest, test, expect } from '@jest/globals'
import nock from 'nock'

const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
}

jest.unstable_mockModule('node:fs/promises', () => mockFs)

const { updateNodeVersion } = await import('../src/updateNodeVersion.js')

test('updates node version in files', async () => {
  if (process.platform === 'win32') {
    return
  }
  mockFs.readFile.mockImplementation((path) => {
    if (path === '/test/.nvmrc') {
      return 'v18.0.0'
    }
    if (path === '/test/Dockerfile') {
      return 'FROM node:18.0.0\nWORKDIR /app'
    }
    if (path === '/test/.gitpod.Dockerfile') {
      return 'FROM gitpod/workspace-full\nRUN nvm install 18.0.0 \\ \n && nvm use 22.9.0 \\ \n && nvm alias default 22.9.0'
    }
    throw new Error('File not found')
  })

  const mock = nock('https://nodejs.org')
    .get('/dist/index.json')
    .reply(200, [
      {
        version: 'v26.0.0',
        lts: false,
      },
      {
        version: 'v24.0.0',
        lts: 'Iron',
      },
    ])

  await updateNodeVersion({
    root: '/test',
  })

  expect(mockFs.writeFile).toHaveBeenCalledWith('/test/.nvmrc', 'v24.0.0\n')
  expect(mockFs.writeFile).toHaveBeenCalledWith('/test/Dockerfile', 'FROM node:24.0.0\nWORKDIR /app')
  expect(mockFs.writeFile).toHaveBeenNthCalledWith(
    3,
    '/test/.gitpod.Dockerfile',
    'FROM gitpod/workspace-full\nRUN nvm install 24.0.0 \\ \n && nvm use 24.0.0 \\ \n && nvm alias default 24.0.0',
  )
  expect(mock.isDone()).toBe(true)
})
