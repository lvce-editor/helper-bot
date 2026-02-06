import type * as FsPromises from 'node:fs/promises'
import type { ExecFunction } from '../Types/Types.ts'

/**
 * Checks if ESLint 10 is in package.json and downgrades to latest 9.x
 * @returns true if downgrade was performed, false otherwise
 */
export const downgradeEslintIfNeeded = async (
  fs: Readonly<typeof FsPromises>,
  exec: ExecFunction,
  packageJsonUri: string,
  workingDir: string,
): Promise<boolean> => {
  try {
    // Read package.json
    const packageJsonContent = await fs.readFile(packageJsonUri, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)

    // Check if eslint 10 is present in dependencies or devDependencies
    const hasEslint10InDeps = packageJson.dependencies?.eslint?.match(/[\^~]?10\./)
    const hasEslint10InDevDeps = packageJson.devDependencies?.eslint?.match(/[\^~]?10\./)

    if (!hasEslint10InDeps && !hasEslint10InDevDeps) {
      return false
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
