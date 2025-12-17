import { addGitattributes } from '../AddGitattributes/AddGitattributes.ts'
import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { computeNewDockerfileContent } from '../ComputeNewDockerfileContent/ComputeNewDockerfileContent.ts'
import { computeNewGitpodDockerfileContent } from '../ComputeNewGitpodDockerfileContent/ComputeNewGitpodDockerfileContent.ts'
import { computeNewNvmrcContent } from '../ComputeNewNvmrcContent/ComputeNewNvmrcContent.ts'
import { getNewPackageFiles } from '../GetNewPackageFiles/GetNewPackageFiles.ts'
import { handleHelloWorld } from '../HandleHelloWorld/HandleHelloWorld.ts'
import { handleReleaseReleased } from '../HandleReleaseReleased/HandleReleaseReleased.ts'
import { listCommands2 } from '../ListCommands2/ListCommands2.ts'
import { listCommands } from '../ListCommands/ListCommands.ts'
import { removeGitpodSection } from '../RemoveGitpodSection/RemoveGitpodSection.ts'
import { removeNpmTokenFromWorkflow } from '../RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
import { updateBuiltinExtensions } from '../UpdateBuiltinExtensions/UpdateBuiltinExtensions.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'
import { updateGithubActions } from '../UpdateGithubActions/UpdateGithubActions.ts'
import { updateNodeVersion } from '../UpdateNodeVersion/UpdateNodeVersion.ts'
import { updateRepositoryDependencies } from '../UpdateRepositoryDependencies/UpdateRepositoryDependencies.ts'
import { wrapCommand, wrapResponseCommand } from '../WrapCommand/WrapCommand.ts'
<<<<<<< HEAD
=======
import { handleHelloWorld } from '../HandleHelloWorld/HandleHelloWorld.ts'
import { listCommands2 } from '../ListCommands2/ListCommands2.ts'
import { handleMigrationsList } from '../HandleMigrationsList/HandleMigrationsList.ts'
>>>>>>> origin/main

export const commandMap = {
  '/hello-world': wrapResponseCommand(handleHelloWorld),
  '/meta/list-commands-2': listCommands2,
  '/migrations/add-gitattributes': wrapCommand(addGitattributes),
  '/migrations/add-oidc-permissions': wrapCommand(addOidcPermissionsToWorkflow),
  '/migrations/ensure-lerna-excluded': wrapCommand(computeEnsureLernaExcludedContent),
  '/migrations/remove-gitpod-section': wrapCommand(removeGitpodSection),
  '/migrations/remove-npm-token': wrapCommand(removeNpmTokenFromWorkflow),
  '/migrations/update-dependencies': wrapCommand(updateDependencies),
  '/migrations/update-github-actions': wrapCommand(updateGithubActions),
  '/migrations/update-node-version': wrapCommand(updateNodeVersion),
  computeNewDockerfileContent: wrapCommand(computeNewDockerfileContent),
  computeNewGitpodDockerfileContent: wrapCommand(computeNewGitpodDockerfileContent),
<<<<<<< HEAD
  computeNewNvmrcContent: wrapCommand(computeNewNvmrcContent),
  getNewPackageFiles: wrapCommand(getNewPackageFiles),
=======
  '/migrations/ensure-lerna-excluded': wrapCommand(computeEnsureLernaExcludedContent),
  '/migrations/remove-npm-token': wrapCommand(removeNpmTokenFromWorkflow),
  '/migrations/remove-gitpod-section': wrapCommand(removeGitpodSection),
  '/migrations/update-node-version': wrapCommand(updateNodeVersion),
  '/migrations/update-dependencies': wrapCommand(updateDependencies),
  '/migrations/add-gitattributes': wrapCommand(addGitattributes),
  '/migrations/update-github-actions': wrapCommand(updateGithubActions),
  updateRepositoryDependencies: wrapCommand(updateRepositoryDependencies),
  updateBuiltinExtensions: wrapCommand(updateBuiltinExtensions),
  'migrations/handle-release-released': wrapCommand(handleReleaseReleased),
  '/hello-world': wrapResponseCommand(handleHelloWorld),
  '/migrations/list': wrapResponseCommand(handleMigrationsList),
>>>>>>> origin/main
  listCommands: wrapCommand(listCommands),
  'migrations/handle-release-released': wrapCommand(handleReleaseReleased),
  updateBuiltinExtensions: wrapCommand(updateBuiltinExtensions),
  updateRepositoryDependencies: wrapCommand(updateRepositoryDependencies),
}
