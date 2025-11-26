import { addGitattributes } from '../AddGitattributes/AddGitattributes.ts'
import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewGitpodDockerfileContent } from '../ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { getNewPackageFiles } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { handleReleaseReleased } from '../HandleReleaseReleased/HandleReleaseReleased.ts'
import { listCommands } from '../ListCommands/ListCommands.ts'
import { removeNpmTokenFromWorkflow } from '../RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
import { updateBuiltinExtensions } from '../UpdateBuiltinExtensions/UpdateBuiltinExtensions.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'
import { updateNodeVersion } from '../UpdateNodeVersion/UpdateNodeVersion.ts'
import { updateGithubActions } from '../UpdateGithubActions/UpdateGithubActions.ts'
import { updateRepositoryDependencies } from '../UpdateRepositoryDependencies/UpdateRepositoryDependencies.ts'
import { wrapCommand } from '../WrapCommand/WrapCommand.ts'

export const commandMap = {
  getNewPackageFiles: wrapCommand(getNewPackageFiles),
  'migrations/add-oidc-permissions': wrapCommand(addOidcPermissionsToWorkflow),
  computeNewNvmrcContent: wrapCommand(computeNewNvmrcContent),
  computeNewDockerfileContent: wrapCommand(computeNewDockerfileContent),
  computeNewGitpodDockerfileContent: wrapCommand(
    computeNewGitpodDockerfileContent,
  ),
  'migrations/ensure-lerna-excluded': wrapCommand(
    computeEnsureLernaExcludedContent,
  ),
  'migrations/remove-npm-token': wrapCommand(removeNpmTokenFromWorkflow),
  'migrations/update-node-version': wrapCommand(updateNodeVersion),
  'migrations/update-dependencies': wrapCommand(updateDependencies),
  'migrations/add-gitattributes': wrapCommand(addGitattributes),
  'migrations/update-github-actions': wrapCommand(updateGithubActions),
  updateRepositoryDependencies: wrapCommand(updateRepositoryDependencies),
  updateBuiltinExtensions: wrapCommand(updateBuiltinExtensions),
  'migrations/handle-release-released': wrapCommand(handleReleaseReleased),
  listCommands: wrapCommand(listCommands),
}
