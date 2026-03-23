import type * as FsPromises from 'node:fs/promises'
import type { ExecFunction } from '../Types/Types.ts'

export interface PreviousEslintVersions {
  dependencies?: string
  devDependencies?: string
}

const getMajorVersion = (version: unknown): number | undefined => {
  if (typeof version !== 'string') {
    return undefined
  }
  const match = version.match(/\d+/)
  if (!match) {
    return undefined
  }
  return Number(match[0])
}

const isEslint10 = (version: unknown): boolean => {
  return getMajorVersion(version) === 10
}

const restorePreviousEslintVersions = (packageJson: any, previousVersions?: Readonly<PreviousEslintVersions>): boolean => {
  let restored = false
  const fallbackVersion = previousVersions?.dependencies ?? previousVersions?.devDependencies

  if (isEslint10(packageJson.dependencies?.eslint)) {
    const previousVersion = previousVersions?.dependencies ?? fallbackVersion
    if (previousVersion && packageJson.dependencies) {
      packageJson.dependencies.eslint = previousVersion
      restored = true
    }
  }

  if (isEslint10(packageJson.devDependencies?.eslint)) {
    const previousVersion = previousVersions?.devDependencies ?? fallbackVersion
    if (previousVersion && packageJson.devDependencies) {
      packageJson.devDependencies.eslint = previousVersion
      restored = true
    }
  }

  return restored
}

/**
 * Checks if ESLint 10 is in package.json and restores previous versions when possible.
 * If no previous version is known, it downgrades to latest 9.x via npm.
 * @returns true if changes were applied, false otherwise
 */
export const downgradeEslintIfNeeded = async (
  fs: Readonly<typeof FsPromises>,
  exec: ExecFunction,
  packageJsonUri: string,
  workingDir: string,
  previousVersions?: Readonly<PreviousEslintVersions>,
): Promise<boolean> => {
  try {
    // Read package.json
    const packageJsonContent = await fs.readFile(packageJsonUri, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)

    // Check if eslint 10 is present in dependencies or devDependencies
    const hasEslint10InDeps = isEslint10(packageJson.dependencies?.eslint)
    const hasEslint10InDevDeps = isEslint10(packageJson.devDependencies?.eslint)

    if (!hasEslint10InDeps && !hasEslint10InDevDeps) {
      return false
    }

    const restored = restorePreviousEslintVersions(packageJson, previousVersions)
    if (restored) {
      await fs.writeFile(packageJsonUri, JSON.stringify(packageJson, null, 2) + '\n')
    }

    const stillHasEslint10InDeps = isEslint10(packageJson.dependencies?.eslint)
    const stillHasEslint10InDevDeps = isEslint10(packageJson.devDependencies?.eslint)
    if (!stillHasEslint10InDeps && !stillHasEslint10InDevDeps) {
      return true
    }

    // Downgrade ESLint to latest 9.x using npm
    await exec('npm', ['install', '--save-dev', 'eslint@^9', '--ignore-scripts', '--prefer-online'], {
      cwd: workingDir,
    })

    return true
  } catch (error) {
    console.warn('[downgrade-eslint] Failed to check or downgrade ESLint:', error)
    return false
  }
}
