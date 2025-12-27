import { test, expect } from '@jest/globals'
import { parseGitStatus } from '../src/parts/GetChangedFiles/ParseGitStatus.ts'

test('parses modified file', () => {
  const output = ' M src/file.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/file.ts',
    },
  ])
})

test('parses staged modified file', () => {
  const output = 'M  src/file.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: 'M ',
      filePath: 'src/file.ts',
    },
  ])
})

test('parses added file', () => {
  const output = 'A  src/new-file.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: 'A ',
      filePath: 'src/new-file.ts',
    },
  ])
})

test('parses untracked file', () => {
  const output = '?? src/untracked.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: '??',
      filePath: 'src/untracked.ts',
    },
  ])
})

test('parses deleted file', () => {
  const output = ' D src/deleted.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' D',
      filePath: 'src/deleted.ts',
    },
  ])
})

test('parses staged deleted file', () => {
  const output = 'D  src/deleted.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: 'D ',
      filePath: 'src/deleted.ts',
    },
  ])
})

test('parses renamed file', () => {
  const output = 'R  src/old.ts -> src/new.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: 'R ',
      filePath: 'src/old.ts -> src/new.ts',
    },
  ])
})

test('parses multiple files', () => {
  const output = ` M src/file1.ts
A  src/file2.ts
?? src/file3.ts`
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/file1.ts',
    },
    {
      status: 'A ',
      filePath: 'src/file2.ts',
    },
    {
      status: '??',
      filePath: 'src/file3.ts',
    },
  ])
})

test('parses file with spaces in path', () => {
  const output = ' M src/file with spaces.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/file with spaces.ts',
    },
  ])
})

test('parses file in root directory', () => {
  const output = ' M README.md'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'README.md',
    },
  ])
})

test('handles empty output', () => {
  const output = ''
  const result = parseGitStatus(output)

  expect(result).toEqual([])
})

test('handles output with only newlines', () => {
  const output = '\n\n\n'
  const result = parseGitStatus(output)

  expect(result).toEqual([])
})

test('handles output with whitespace-only lines', () => {
  const output = '   \n\t\n M src/file.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/file.ts',
    },
  ])
})

test('skips lines that are too short', () => {
  const output = ` M src/file.ts
AB
??`
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/file.ts',
    },
  ])
})

test('handles mixed status codes', () => {
  const output = ` M src/modified.ts
A  src/added.ts
D  src/deleted.ts
?? src/untracked.ts
R  src/old.ts -> src/new.ts`
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/modified.ts',
    },
    {
      status: 'A ',
      filePath: 'src/added.ts',
    },
    {
      status: 'D ',
      filePath: 'src/deleted.ts',
    },
    {
      status: '??',
      filePath: 'src/untracked.ts',
    },
    {
      status: 'R ',
      filePath: 'src/old.ts -> src/new.ts',
    },
  ])
})

test('handles file path with leading spaces after status', () => {
  const output = ' M  src/file.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/file.ts',
    },
  ])
})

test('handles file path with trailing spaces', () => {
  const output = ' M src/file.ts   '
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/file.ts',
    },
  ])
})

test('handles both modified in index and working tree', () => {
  const output = 'MM src/file.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: 'MM',
      filePath: 'src/file.ts',
    },
  ])
})

test('handles copied file', () => {
  const output = 'C  src/original.ts -> src/copy.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: 'C ',
      filePath: 'src/original.ts -> src/copy.ts',
    },
  ])
})

test('handles file with unicode characters in path', () => {
  const output = ' M src/文件.ts'
  const result = parseGitStatus(output)

  expect(result).toEqual([
    {
      status: ' M',
      filePath: 'src/文件.ts',
    },
  ])
})
