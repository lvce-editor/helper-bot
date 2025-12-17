import { readFile, writeFile, chmod } from 'node:fs/promises'

export const ensureLernaExcluded = async (scriptPath: string): Promise<void> => {
  try {
    const scriptContent = await readFile(scriptPath, 'utf8')

    // Check if the script contains any ncu commands
    const ncuRegex = /OUTPUT=`ncu -u(.*?)`/g
    const matches = [...scriptContent.matchAll(ncuRegex)]

    if (matches.length === 0) {
      console.log('No ncu command found in update-dependencies.sh script')
      return
    }

    let updatedContent = scriptContent
    let hasChanges = false

    // Process each ncu command
    for (const match of matches) {
      const ncuCommand = match[1]

      // Check if lerna is already excluded
      if (!ncuCommand.includes('-x lerna')) {
        // Add lerna to the exclusion list
        let updatedCommand: string
        if (ncuCommand.trim() === '') {
          // No existing exclusions
          updatedCommand = ' -x lerna'
        } else {
          // Has existing exclusions, add lerna to the end
          updatedCommand = ncuCommand.replace(/(-x [^-]+)+$/, (match) => `${match} -x lerna`)
        }

        updatedContent = updatedContent.replace(match[0], `OUTPUT=\`ncu -u${updatedCommand}\``)
        hasChanges = true
      }
    }

    if (hasChanges) {
      await writeFile(scriptPath, updatedContent, 'utf8')
      // Ensure the script remains executable after modification
      await chmod(scriptPath, 0o755)
      console.log('Added lerna exclusion to update-dependencies.sh script')
    } else {
      console.log('Lerna is already excluded in update-dependencies.sh script')
    }
  } catch (error) {
    console.warn('Failed to check/modify update-dependencies.sh script:', error)
  }
}
