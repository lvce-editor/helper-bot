import { applyMigrationResult } from '../ApplyMigrationResult/ApplyMigrationResult.ts'
import { commitFiles } from '../CommitFiles/CommitFiles.ts'
import { createBranch } from '../CreateBranch/CreateBranch.ts'
import { createPullRequest } from '../CreatePullRequest/CreatePullRequest.ts'
import { deleteClassicBranchProtection } from '../DeleteClassicBranchProtection/DeleteClassicBranchProtection.ts'
import { updateBranchProtection } from '../UpdateBranchProtection/UpdateBranchProtection.ts'
import { wrapFunction } from '../WrapFunction/WrapFunction.ts'

export const commandMap = {
  '/github/apply-migration-result': wrapFunction(applyMigrationResult),
  '/github/commit-files': wrapFunction(commitFiles),
  '/github/create-branch': wrapFunction(createBranch),
  '/github/create-pull-request': wrapFunction(createPullRequest),
  '/github/delete-classic-branch-protection': wrapFunction(deleteClassicBranchProtection),
  '/github/update-branch-protection': wrapFunction(updateBranchProtection),
}
