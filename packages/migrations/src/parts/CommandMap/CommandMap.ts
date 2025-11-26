import { getNewPackageFiles } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewGitpodDockerfileContent } from '../ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'

export const commandMap = {
  getNewPackageFiles,
  addOidcPermissionsToWorkflow,
  computeNewNvmrcContent,
  computeNewDockerfileContent,
  computeNewGitpodDockerfileContent,
  computeEnsureLernaExcludedContent,
}
