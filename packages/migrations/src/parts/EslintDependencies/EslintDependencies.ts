export const eslintPackageName = 'eslint'
export const eslintConfigPackageName = '@lvce-editor/eslint-config'

export interface EslintDependencyVersions {
  readonly eslint?: string
  readonly eslintConfig?: string
}

export interface LatestEslintDependencyVersions {
  readonly eslintConfigVersion: string
  readonly eslintVersion: string
}

const dependencyKeys = ['dependencies', 'devDependencies', 'optionalDependencies'] as const

const getDependencyVersion = (packageJson: any, dependencyName: string): string | undefined => {
  for (const key of dependencyKeys) {
    const version = packageJson[key]?.[dependencyName]
    if (typeof version === 'string') {
      return version
    }
  }
  return undefined
}

export const getEslintDependencyVersions = (packageJson: any): EslintDependencyVersions => {
  const eslint = getDependencyVersion(packageJson, eslintPackageName)
  const eslintConfig = getDependencyVersion(packageJson, eslintConfigPackageName)
  return {
    ...(eslint && { eslint }),
    ...(eslintConfig && { eslintConfig }),
  }
}

const normalizeVersion = (version: string): string => {
  return version.replace(/^[\^~>=<]+/, '')
}

export const isDependencyVersionUpToDate = (installedVersion: string | undefined, latestVersion: string): boolean => {
  return installedVersion !== undefined && normalizeVersion(installedVersion) === normalizeVersion(latestVersion)
}

export const hasEslintDependencies = (versions: Readonly<EslintDependencyVersions>): boolean => {
  return versions.eslint !== undefined || versions.eslintConfig !== undefined
}

export const needsEslintDependencyUpdate = (
  currentVersions: Readonly<EslintDependencyVersions>,
  latestVersions: Readonly<LatestEslintDependencyVersions>,
): boolean => {
  if (!hasEslintDependencies(currentVersions)) {
    return false
  }
  return (
    !isDependencyVersionUpToDate(currentVersions.eslint, latestVersions.eslintVersion) ||
    !isDependencyVersionUpToDate(currentVersions.eslintConfig, latestVersions.eslintConfigVersion)
  )
}
