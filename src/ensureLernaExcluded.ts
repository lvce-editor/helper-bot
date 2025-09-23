import { readFile, writeFile } from 'node:fs/promises'

export const ensureLernaExcluded = async (
  scriptPath: string,
): Promise<void> => {
  try {
    const scriptContent = await readFile(scriptPath, 'utf8')

    // Check if the script contains an ncu command and if lerna is already excluded
    const ncuRegex = /OUTPUT=`ncu -u(.*?)`/
    const match = scriptContent.match(ncuRegex)

    if (match) {
      const ncuCommand = match[1]

      // Check if lerna is already excluded
      if (!ncuCommand.includes('-x lerna')) {
        // Add lerna to the exclusion list
        const updatedCommand = ncuCommand.replace(
          /(-x [^-]+)+$/,
          (match) => `${match} -x lerna`,
        )

        const updatedContent = scriptContent.replace(
          ncuRegex,
          `OUTPUT=\`ncu -u${updatedCommand}\``,
        )

        await writeFile(scriptPath, updatedContent, 'utf8')
        console.log('Added lerna exclusion to update-dependencies.sh script')
      } else {
        console.log(
          'Lerna is already excluded in update-dependencies.sh script',
        )
      }
    } else {
      console.log('No ncu command found in update-dependencies.sh script')
    }
  } catch (error) {
    console.warn('Failed to check/modify update-dependencies.sh script:', error)
  }
}
