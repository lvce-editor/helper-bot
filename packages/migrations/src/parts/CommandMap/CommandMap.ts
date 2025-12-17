import { addGitattributes } from '../AddGitattributes/AddGitattributes.ts'
import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { handleHelloWorld } from '../HandleHelloWorld/HandleHelloWorld.ts'
import { handleMigrationsList } from '../HandleMigrationsList/HandleMigrationsList.ts'
import { handleReleaseReleased } from '../HandleReleaseReleased/HandleReleaseReleased.ts'
import { listCommands2 } from '../ListCommands2/ListCommands2.ts'
import { removeGitpodSection } from '../RemoveGitpodSection/RemoveGitpodSection.ts'
import { removeNpmTokenFromWorkflow } from '../RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'
import { updateGithubActions } from '../UpdateGithubActions/UpdateGithubActions.ts'
import { updateNodeVersion } from '../UpdateNodeVersion/UpdateNodeVersion.ts'
import { wrapCommand, wrapResponseCommand } from '../WrapCommand/WrapCommand.ts'

export const commandMap = {
  '/hello-world': wrapResponseCommand(handleHelloWorld),
  '/meta/list-commands-2': listCommands2,
  '/migrations2/add-gitattributes': wrapCommand(addGitattributes),
  '/migrations2/add-oidc-permissions': wrapCommand(addOidcPermissionsToWorkflow),
  '/migrations2/ensure-lerna-excluded': wrapCommand(computeEnsureLernaExcludedContent),
  '/migrations2/handle-release-released': wrapCommand(handleReleaseReleased),
  '/migrations2/list': wrapResponseCommand(handleMigrationsList),
  '/migrations2/remove-gitpod-section': wrapCommand(removeGitpodSection),
  '/migrations2/remove-npm-token': wrapCommand(removeNpmTokenFromWorkflow),
  '/migrations2/update-dependencies': wrapCommand(updateDependencies),
  '/migrations2/update-github-actions': wrapCommand(updateGithubActions),
  '/migrations2/update-node-version': wrapCommand(updateNodeVersion),
}
