import { addDevcontainerJson } from '../AddDevcontainerJson/AddDevcontainerJson.ts'
import { addEslint } from '../AddEslint/AddEslint.ts'
import { addEslintConfig } from '../AddEslintConfig/AddEslintConfig.ts'
import { addGitattributes } from '../AddGitattributes/AddGitattributes.ts'
import { addLintScript } from '../AddLintScript/AddLintScript.ts'
import { addOidcPermissionsToWorkflow } from '../AddOidcPermissionsToWorkflow/AddOidcPermissionsToWorkflow.ts'
import { computeEnsureLernaExcludedContent } from '../ComputeEnsureLernaExcludedContent/ComputeEnsureLernaExcludedContent.ts'
import { createPrereleaseBeforeRelease } from '../CreatePrereleaseBeforeRelease/CreatePrereleaseBeforeRelease.ts'
import { getBranchProtection } from '../GetBranchProtection/GetBranchProtection.ts'
import { handleHelloWorld } from '../HandleHelloWorld/HandleHelloWorld.ts'
import { handleMigrationsList } from '../HandleMigrationsList/HandleMigrationsList.ts'
import { handleReleaseReleased } from '../HandleReleaseReleased/HandleReleaseReleased.ts'
import { initializePackageJson } from '../InitializePackageJson/InitializePackageJson.ts'
import { lintAndFix } from '../LintAndFix/LintAndFix.ts'
import { listCommands2 } from '../ListCommands2/ListCommands2.ts'
import { modernDirname } from '../ModernDirname/ModernDirname.ts'
import { modernizeBranchProtection } from '../ModernizeBranchProtection/ModernizeBranchProtection.ts'
import { multiMigrationsUpdateNodeVersion } from '../MultiMigrationsUpdateNodeVersion/MultiMigrationsUpdateNodeVersion.ts'
import { removeGitpodSection } from '../RemoveGitpodSection/RemoveGitpodSection.ts'
import { removeGitpodyml } from '../RemoveGitpodyml/RemoveGitpodyml.ts'
import { removeNpmTokenFromWorkflow } from '../RemoveNpmTokenFromWorkflow/RemoveNpmTokenFromWorkflow.ts'
import { runLintInCi } from '../RunLintInCi/RunLintInCi.ts'
import { updateCiVersions } from '../UpdateCiVersions/UpdateCiVersions.ts'
import { updateDependencies } from '../UpdateDependencies/UpdateDependencies.ts'
import { updateGithubActions } from '../UpdateGithubActions/UpdateGithubActions.ts'
import { updateNodeVersion } from '../UpdateNodeVersion/UpdateNodeVersion.ts'
import { updateSpecificDependency } from '../UpdateSpecificDependency/UpdateSpecificDependency.ts'
import { wrapCommand, wrapResponseCommand } from '../WrapCommand/WrapCommand.ts'

export const commandMap = {
  '/hello-world': wrapResponseCommand(handleHelloWorld),
  '/meta/list-commands-2': listCommands2,
  '/migrations2/add-devcontainer-json': wrapCommand(addDevcontainerJson),
  '/migrations2/add-eslint': wrapCommand(addEslint),
  '/migrations2/add-eslint-config': wrapCommand(addEslintConfig),
  '/migrations2/add-gitattributes': wrapCommand(addGitattributes),
  '/migrations2/add-lint-script': wrapCommand(addLintScript),
  '/migrations2/add-oidc-permissions': wrapCommand(addOidcPermissionsToWorkflow),
  '/migrations2/create-prerelease-before-release': wrapCommand(createPrereleaseBeforeRelease),
  '/migrations2/ensure-lerna-excluded': wrapCommand(computeEnsureLernaExcludedContent),
  '/migrations2/get-branch-protection': wrapCommand(getBranchProtection),
  '/migrations2/handle-release-released': wrapCommand(handleReleaseReleased),
  '/migrations2/initialize-package-json': wrapCommand(initializePackageJson),
  '/migrations2/js/modern-dirname': wrapCommand(modernDirname),
  '/migrations2/lint-and-fix': wrapCommand(lintAndFix),
  '/migrations2/list': wrapResponseCommand(handleMigrationsList),
  '/migrations2/modernize-branch-protection': wrapCommand(modernizeBranchProtection),
  '/migrations2/remove-gitpod-section': wrapCommand(removeGitpodSection),
  '/migrations2/remove-gitpod-yml': wrapCommand(removeGitpodyml),
  '/migrations2/remove-npm-token': wrapCommand(removeNpmTokenFromWorkflow),
  '/migrations2/run-lint-in-ci': wrapCommand(runLintInCi),
  '/migrations2/update-ci-versions': wrapCommand(updateCiVersions),
  '/migrations2/update-dependencies': wrapCommand(updateDependencies),
  '/migrations2/update-github-actions': wrapCommand(updateGithubActions),
  '/migrations2/update-node-version': wrapCommand(updateNodeVersion),
  '/migrations2/update-specific-dependency': wrapCommand(updateSpecificDependency),
  '/multi-migrations/update-node-version': wrapCommand(multiMigrationsUpdateNodeVersion),
}
