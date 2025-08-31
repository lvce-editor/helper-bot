import type { Context } from 'probot'

export interface UpdateGithubActionsParams {
  octokit: Context<'release'>['octokit']
  owner: string
  repo: string
  baseBranch?: string
  osVersions: {
    ubuntu?: string
    windows?: string
    macos?: string
  }
}

const WORKFLOWS_DIR = '.github/workflows'

const encodeBase64 = (content: string): string => {
  return Buffer.from(content).toString('base64')
}

const decodeBase64 = (content: string): string => {
  return Buffer.from(content, 'base64').toString()
}

const updateOsVersionsInYaml = (
  yamlContent: string,
  osVersions: UpdateGithubActionsParams['osVersions'],
): string => {
  let updated = yamlContent
  if (osVersions.ubuntu) {
    updated = updated.replace(
      /ubuntu-\d{2}\.\d{2}/g,
      `ubuntu-${osVersions.ubuntu}`,
    )
  }
  if (osVersions.windows) {
    updated = updated.replace(/windows-\d{4}/g, `windows-${osVersions.windows}`)
  }
  if (osVersions.macos) {
    updated = updated.replace(/macos-\d+/g, `macos-${osVersions.macos}`)
  }
  return updated
}

export const updateGithubActions = async (
  params: UpdateGithubActionsParams,
): Promise<{ changedFiles: number; newBranch?: string } | undefined> => {
  const { octokit, owner, repo, osVersions } = params
  const baseBranch = params.baseBranch || 'main'

  // List workflow files
  let workflows
  try {
    const result = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: WORKFLOWS_DIR,
      ref: baseBranch,
    })
    if (Array.isArray(result.data)) {
      workflows = result.data.filter((entry: any) => {
        return (
          entry.type === 'file' &&
          (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))
        )
      })
    } else {
      // Single file case is unexpected for a directory path; bail
      return undefined
    }
  } catch (error: any) {
    if (error && error.status === 404) {
      // No workflows directory, nothing to do
      return undefined
    }
    throw error
  }

  const changed: Array<{
    path: string
    originalSha: string
    newContent: string
  }> = []

  // Fetch and update each workflow file
  for (const file of workflows) {
    const filePath = file.path as string
    const fileRef = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: baseBranch,
    })
    if (!('content' in fileRef.data)) {
      continue
    }
    const originalSha = fileRef.data.sha as string
    const decoded = decodeBase64(fileRef.data.content as string)
    const updated = updateOsVersionsInYaml(decoded, osVersions)
    if (updated !== decoded) {
      // Ensure trailing newline like repo style
      const finalContent = updated.endsWith('\n') ? updated : updated + '\n'
      changed.push({ path: filePath, originalSha, newContent: finalContent })
    }
  }

  if (changed.length === 0) {
    return { changedFiles: 0 }
  }

  // Create a new branch from baseBranch
  const newBranch = `update-gh-actions-${Date.now()}`
  const baseRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  })

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: baseRef.data.object.sha,
  })

  // Commit updates file-by-file on the new branch
  for (const change of changed) {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: change.path,
      message: 'ci: update GitHub Actions OS versions',
      content: encodeBase64(change.newContent),
      branch: newBranch,
      sha: change.originalSha,
    })
  }

  await octokit.rest.pulls.create({
    owner,
    repo,
    head: newBranch,
    base: baseBranch,
    title: 'ci: update CI OS versions',
  })

  return { changedFiles: changed.length, newBranch }
}
