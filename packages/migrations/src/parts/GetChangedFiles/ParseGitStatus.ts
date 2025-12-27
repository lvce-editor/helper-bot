export interface ParsedGitStatusEntry {
  readonly status: string
  readonly filePath: string
}

/**
 * Parses git status --porcelain output into structured entries.
 *
 * Git status --porcelain format: XY PATH
 * - X = index status, Y = working tree status
 * - Format is exactly 2 characters for status, then a space, then the path
 * - For untracked files, format is "?? PATH"
 *
 * @param gitStatusOutput - The stdout from `git status --porcelain`
 * @returns Array of parsed entries with status and filePath
 */
export const parseGitStatus = (gitStatusOutput: string): ParsedGitStatusEntry[] => {
  const entries: ParsedGitStatusEntry[] = []
  const outputLines = gitStatusOutput.split('\n').filter((line) => line.trim().length > 0)

  for (const line of outputLines) {
    // Git status --porcelain format: XY PATH
    // X = index status, Y = working tree status
    // Format is exactly 2 characters for status, then a space, then the path
    // For untracked files, format is "?? PATH"
    if (line.length < 4) {
      continue
    }

    const status = line.slice(0, 2)
    const filePath = line.slice(3).trim()

    entries.push({
      status,
      filePath,
    })
  }

  return entries
}
