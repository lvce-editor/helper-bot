export const incrementMinorVersion = (tagName: string): string => {
  // Remove 'v' prefix if present
  const hasVPrefix = tagName.startsWith('v')
  const versionWithoutPrefix = hasVPrefix ? tagName.slice(1) : tagName

  // Parse version (format: major.minor.patch)
  const parts = versionWithoutPrefix.split('.')
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${tagName}. Expected format: major.minor.patch`)
  }

  const major = Number.parseInt(parts[0], 10)
  const minor = Number.parseInt(parts[1], 10)
  const patch = Number.parseInt(parts[2], 10)

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    throw new TypeError(`Invalid version format: ${tagName}. All parts must be numbers`)
  }

  // Increment minor version and reset patch to 0
  const newMinor = minor + 1
  const newVersion = `${major}.${newMinor}.0`

  // Restore 'v' prefix if it was present
  return hasVPrefix ? `v${newVersion}` : newVersion
}
