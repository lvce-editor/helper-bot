import { test, expect } from '@jest/globals'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkAndAddGitattributes } from '../src/migrations/addGitattributes.js'

test('should add .gitattributes file when it does not exist', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-add-gitattributes-'))

  try {
    // Create a test directory without .gitattributes
    const testFile = join(tempDir, 'test.txt')
    await writeFile(testFile, 'test content', 'utf8')

    // Verify .gitattributes doesn't exist
    const gitattributesPath = join(tempDir, '.gitattributes')
    await expect(readFile(gitattributesPath, 'utf8')).rejects.toThrow()

    // Call the function
    const result = await checkAndAddGitattributes(tempDir)

    // Should return true indicating changes were made
    expect(result).toBe(true)

    // Verify .gitattributes was created with correct content
    const content = await readFile(gitattributesPath, 'utf8')
    expect(content).toBe('* text=auto eol=lf\n')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should not modify existing .gitattributes file', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-gitattributes-exists-'))

  try {
    // Create a test .gitattributes file
    const gitattributesPath = join(tempDir, '.gitattributes')
    const existingContent = '* text=auto eol=crlf\n*.js text eol=lf\n'
    await writeFile(gitattributesPath, existingContent, 'utf8')

    // Call the function
    const result = await checkAndAddGitattributes(tempDir)

    // Should return false indicating no changes were made
    expect(result).toBe(false)

    // Verify the file content hasn't changed
    const finalContent = await readFile(gitattributesPath, 'utf8')
    expect(finalContent).toBe(existingContent)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should handle file read error gracefully', async () => {
  const nonExistentPath = join(tmpdir(), 'non-existent-directory')

  // Should not throw an error and should return false (indicating it couldn't create the file)
  const result = await checkAndAddGitattributes(nonExistentPath)
  expect(result).toBe(false)
})
