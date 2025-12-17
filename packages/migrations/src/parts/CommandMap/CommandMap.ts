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
  '/migrations/add-gitattributes': wrapCommand(addGitattributes),
  '/migrations/add-oidc-permissions': wrapCommand(addOidcPermissionsToWorkflow),
  '/migrations/ensure-lerna-excluded': wrapCommand(computeEnsureLernaExcludedContent),
  '/migrations/list': wrapResponseCommand(handleMigrationsList),
  '/migrations/remove-gitpod-section': wrapCommand(removeGitpodSection),
  '/migrations/remove-npm-token': wrapCommand(removeNpmTokenFromWorkflow),
  '/migrations/update-dependencies': wrapCommand(updateDependencies),
  '/migrations/update-github-actions': wrapCommand(updateGithubActions),
  '/migrations/update-node-version': wrapCommand(updateNodeVersion),
  'migrations/handle-release-released': wrapCommand(handleReleaseReleased),
}
