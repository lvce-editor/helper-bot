import { addGitattributes } from '../AddGitattributes/AddGitattributes.ts'
import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewGitpodDockerfileContent } from '../ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { getNewPackageFiles } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { listCommands } from '../ListCommands/ListCommands.ts'
import { removeNpmTokenFromWorkflow } from '../RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'
import { updateNodeVersion } from '../UpdateNodeVersion/UpdateNodeVersion.ts'
import { updateGithubActions } from '../UpdateGithubActions/UpdateGithubActions.ts'
import { updateRepositoryDependencies } from '../UpdateRepositoryDependencies/UpdateRepositoryDependencies.ts'
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
  updateNodeVersion: wrapCommand(updateNodeVersion),
  updateDependencies: wrapCommand(updateDependencies),
  addGitattributes: wrapCommand(addGitattributes),
  updateGithubActions: wrapCommand(updateGithubActions),
  updateRepositoryDependencies: wrapCommand(updateRepositoryDependencies),
  listCommands: wrapCommand(listCommands),
}
