import { test, expect } from '@jest/globals'
import { mkdtemp, writeFile, readFile, rm, stat, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ensureLernaExcluded } from '../src/ensureLernaExcluded.js'

test('should add lerna exclusion to update-dependencies.sh script', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-ensure-lerna-'))

  try {
    // Create a test update-dependencies.sh script without lerna exclusion
    const scriptContent = `#!/bin/bash

cd $(dirname "$0")
cd ..

command_exists(){
  command -v "$1" &> /dev/null
}

if ! command_exists "ncu"; then
    echo "npm-check-updates is not installed"
    npm i -g npm-check-updates
else
    echo "ncu is installed"
fi

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x jest -x @jest/globals\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies &&

echo "Great Success!"

sleep 2`

    const scriptPath = join(tempDir, 'update-dependencies.sh')
    await writeFile(scriptPath, scriptContent, 'utf8')

    // Read the original content
    const originalContent = await readFile(scriptPath, 'utf8')
    expect(originalContent).toContain('OUTPUT=`ncu -u -x probot -x jest -x @jest/globals`')
    expect(originalContent).not.toContain('-x lerna')

    // Call the function
    await ensureLernaExcluded(scriptPath)

    // Verify the updated content
    const finalContent = await readFile(scriptPath, 'utf8')
    expect(finalContent).toContain('OUTPUT=`ncu -u -x probot -x jest -x @jest/globals -x lerna`')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should not modify script if lerna is already excluded', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-ensure-lerna-already-excluded-'))

  try {
    // Create a test update-dependencies.sh script with lerna already excluded
    const scriptContent = `#!/bin/bash

cd $(dirname "$0")
cd ..

command_exists(){
  command -v "$1" &> /dev/null
}

if ! command_exists "ncu"; then
    echo "npm-check-updates is not installed"
    npm i -g npm-check-updates
else
    echo "ncu is installed"
fi

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x jest -x @jest/globals -x lerna\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies &&

echo "Great Success!"

sleep 2`

    const scriptPath = join(tempDir, 'update-dependencies.sh')
    await writeFile(scriptPath, scriptContent, 'utf8')

    // Read the original content
    const originalContent = await readFile(scriptPath, 'utf8')
    expect(originalContent).toContain('OUTPUT=`ncu -u -x probot -x jest -x @jest/globals -x lerna`')

    // Call the function
    await ensureLernaExcluded(scriptPath)

    // The function should not modify the script since lerna is already excluded
    // Content should remain the same
    const finalContent = await readFile(scriptPath, 'utf8')
    expect(finalContent).toBe(originalContent)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should handle script without ncu command gracefully', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-ensure-lerna-no-ncu-'))

  try {
    // Create a test script without ncu command
    const scriptContent = `#!/bin/bash

echo "This script does not contain ncu command"
echo "It just does some other stuff"`

    const scriptPath = join(tempDir, 'update-dependencies.sh')
    await writeFile(scriptPath, scriptContent, 'utf8')

    // Call the function
    await ensureLernaExcluded(scriptPath)

    // The function should handle this gracefully without errors
    // Content should remain unchanged
    const finalContent = await readFile(scriptPath, 'utf8')
    expect(finalContent).toBe(scriptContent)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should handle script with ncu command but no exclusions', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-ensure-lerna-no-exclusions-'))

  try {
    // Create a test script with ncu command but no exclusions
    const scriptContent = `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies`

    const scriptPath = join(tempDir, 'update-dependencies.sh')
    await writeFile(scriptPath, scriptContent, 'utf8')

    // Call the function
    await ensureLernaExcluded(scriptPath)

    // Should add lerna exclusion
    const finalContent = await readFile(scriptPath, 'utf8')
    expect(finalContent).toContain('OUTPUT=`ncu -u -x lerna`')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should handle script with multiple ncu commands', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-ensure-lerna-multiple-ncu-'))

  try {
    // Create a test script with multiple ncu commands
    const scriptContent = `#!/bin/bash

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x jest\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

function updateDevDependencies {
  echo "updating dev dependencies..."
  OUTPUT=\`ncu -u -x @types/node\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies
updateDevDependencies`

    const scriptPath = join(tempDir, 'update-dependencies.sh')
    await writeFile(scriptPath, scriptContent, 'utf8')

    // Call the function
    await ensureLernaExcluded(scriptPath)

    // Should add lerna exclusion to both ncu commands
    const finalContent = await readFile(scriptPath, 'utf8')
    expect(finalContent).toContain('OUTPUT=`ncu -u -x probot -x jest -x lerna`')
    expect(finalContent).toContain('OUTPUT=`ncu -u -x @types/node -x lerna`')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should handle file read error gracefully', async () => {
  const nonExistentPath = join(tmpdir(), 'non-existent-script.sh')

  // Should not throw an error
  await expect(ensureLernaExcluded(nonExistentPath)).resolves.toBeUndefined()
})

test('should handle file write error gracefully', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'test-ensure-lerna-write-error-'))

  try {
    // Create a test script
    const scriptContent = `#!/bin/bash
OUTPUT=\`ncu -u -x probot\``

    const scriptPath = join(tempDir, 'update-dependencies.sh')
    await writeFile(scriptPath, scriptContent, 'utf8')

    // Make the file read-only to simulate write error
    await writeFile(scriptPath, scriptContent, { mode: 0o444 })

    // Should not throw an error
    await expect(ensureLernaExcluded(scriptPath)).resolves.toBeUndefined()
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('should preserve executable permissions when updating script', async () => {
  if (process.platform === 'win32') {
    return
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'test-ensure-lerna-executable-'))

  try {
    // Create a test update-dependencies.sh script without lerna exclusion
    const scriptContent = `#!/bin/bash

cd $(dirname "$0")
cd ..

function updateDependencies {
  echo "updating dependencies..."
  OUTPUT=\`ncu -u -x probot -x jest\`
  SUB='All dependencies match the latest package versions'
  if [[ "$OUTPUT" == *"$SUB"* ]]; then
    echo "$OUTPUT"
  else
    rm -rf node_modules package-lock.json dist
    npm install
  fi
}

updateDependencies`

    const scriptPath = join(tempDir, 'update-dependencies.sh')
    await writeFile(scriptPath, scriptContent, 'utf8')

    // Set executable permissions
    await chmod(scriptPath, 0o755)

    // Verify the script has executable permissions before modification
    const statsBefore = await stat(scriptPath)
    const isExecutableBefore = (statsBefore.mode & 0o111) !== 0
    expect(isExecutableBefore).toBe(true)

    // Call the function
    await ensureLernaExcluded(scriptPath)

    // Verify the script still has executable permissions after modification
    const statsAfter = await stat(scriptPath)
    const isExecutableAfter = (statsAfter.mode & 0o111) !== 0
    expect(isExecutableAfter).toBe(true)

    // Also verify the content was updated
    const finalContent = await readFile(scriptPath, 'utf8')
    expect(finalContent).toContain('OUTPUT=`ncu -u -x probot -x jest -x lerna`')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
