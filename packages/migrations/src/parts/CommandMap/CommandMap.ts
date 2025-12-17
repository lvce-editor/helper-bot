import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewGitpodDockerfileContent } from '../ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { getNewPackageFiles } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { removeNpmTokenFromWorkflow } from '../RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
import { wrapCommand } from '../WrapCommand/WrapCommand.ts'

export const commandMap = {
  addOidcPermissionsToWorkflow: wrapCommand(addOidcPermissionsToWorkflow),
  computeEnsureLernaExcludedContent: wrapCommand(computeEnsureLernaExcludedContent),
  computeNewDockerfileContent: wrapCommand(computeNewDockerfileContent),
  computeNewGitpodDockerfileContent: wrapCommand(computeNewGitpodDockerfileContent),
  computeNewNvmrcContent: wrapCommand(computeNewNvmrcContent),
  getNewPackageFiles: wrapCommand(getNewPackageFiles),
  removeNpmTokenFromWorkflow: wrapCommand(removeNpmTokenFromWorkflow),
}
