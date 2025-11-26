import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewGitpodDockerfileContent } from '../ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { getNewPackageFiles } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { removeNpmTokenFromWorkflow } from '../RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
import { wrapCommand } from '../WrapCommand/WrapCommand.ts'

export const commandMap = {
  getNewPackageFiles: wrapCommand(getNewPackageFiles),
  addOidcPermissionsToWorkflow: wrapCommand(addOidcPermissionsToWorkflow),
  computeNewNvmrcContent: wrapCommand(computeNewNvmrcContent),
  computeNewDockerfileContent: wrapCommand(computeNewDockerfileContent),
  computeNewGitpodDockerfileContent: wrapCommand(
    computeNewGitpodDockerfileContent,
  ),
  computeEnsureLernaExcludedContent: wrapCommand(
    computeEnsureLernaExcludedContent,
  ),
  removeNpmTokenFromWorkflow: wrapCommand(removeNpmTokenFromWorkflow),
}
