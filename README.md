# Lvce Editor Helper Bot

GitHub Bot to automaticlly update lvce editor extensions to latest versions.

## Locking old issues and pull requests

The optional issue-locking worker is configured in `packages/app/dependencies.json` under `issueLocking`. It is disabled by default. To enable it, set `enabled` to `true` and list the exact `owner/repository` names to process. The GitHub App installation must have the `issues: write` permission; pull request locking also uses the Issues API.

`olderThanDays` defaults to 45. Issues are eligible from their `closed_at` date; pull requests must be merged and are eligible from `merged_at`. Closed, unmerged pull requests are left open to further conversation. The default run is daily at 07:00 in `Europe/Berlin`, including daylight-saving changes.

Each run scans at most five pages of 100 closed items per configured repository and locks at most 100 items across all configured repositories. Writes are serial and spaced by at least one second. A GitHub rate-limit or permission response stops work for that repository; the next scheduled run retries. The run rechecks each item before locking, so reopened or already-locked items are skipped.

Optional settings are `schedule.hour`, `schedule.minute`, `schedule.timeZone`, `maxPagesPerRun` (1–10), `maxItemsPerRun` (1–100), and `writeIntervalMs` (1–60000). Invalid configuration prevents app startup instead of silently broadening scope. Update and verify the GitHub App installation permissions before enabling this feature in production.

## Repository configuration

Repositories opt in by committing `.github/repository-config.json` on `main` with a snapshot matching their live required checks:

```json
{
  "version": 1,
  "requiredStatusChecks": ["pr (ubuntu-24.04)", "pr (ubuntu-24.04-arm)", "pr (macos-15)", "pr (windows-2025)"]
}
```

Subsequent PRs may change the check names together with the runner versions. All jobs in every `pull_request` workflow must finish successfully. The current implementation supports static jobs and a single `os` matrix, preserves platform coverage, and rejects conditional, renamed, reusable, or dynamic jobs instead of guessing their intended checks. Unsupported workflows require extending the trusted validator first.

Only the exact login/ID pairs `levivilet`/`72156503` and `lvce-editor-helper-bot[bot]`/`155071229` can apply settings. Fork PRs are excluded. This authorization protects administrative application; it does not prevent anyone from opening a PR. Repository maintainers must retain their merge policy for contributions that change configuration or workflows.

The bot dispatches `apply-repository-config.yml` on helper-bot `main` after successful PR workflow completion. Actions checks out only its own trusted revision and reads PR files as bounded JSON/YAML data. No PR code or dependencies execute with administrative credentials. On successful validation the bot revalidates author, head, current main, and every intended job, then applies the configuration with its installation credential. The workflow itself has read-only permissions. A successful validation workflow is not proof of application: the bot posts the application result on the PR after writes finish.

Without `rulesetId`, only classic `main` required status checks are updated, retaining strictness and other protections. With a repository-owned branch `rulesetId`, only that existing ruleset's required checks are updated, retaining its other rules, conditions, enforcement and bypass actors. Organization rulesets are excluded. Checks must belong to GitHub Actions. Optional `settings` may manage `allow_squash_merge`, `allow_merge_commit`, `allow_rebase_merge` and `delete_branch_on_merge`. Bootstrap the ruleset identity and managed setting keys on main before enabling updates; PRs cannot expand their managed fields.

Application creates `refs/heads/helper-bot-repository-config-lock` atomically, making application exclusive across bot replicas. Duplicate deliveries do not repeat administrative writes. A conflicting live snapshot blocks application instead of overwriting another PR's changes. A partial failure is visible in bot logs and a PR failure comment; retry only after inspecting live state. A crashed applier leaves the lock intact: verify that no application is active before a maintainer removes it. Never automatically steal a lock.

Pre-merge changes persist if a PR is abandoned. Do not automatically roll them back, since another revision may depend on them. Reconcile the live snapshot and main configuration explicitly before another config PR. Changes to main or the PR revision invalidate earlier validation; update/rerun the PR rather than applying stale evidence. The bot compares the snapshot before writing and rechecks the PR immediately before writes; external administrators should serialize their changes with this manager.

After every job in the main CI matrix succeeds, CI requests deployment through the existing `DEPLOY_HOOK_URL` secret. Keep that hook configured for this repository’s hosting service and retain the App’s `workflow_run` subscription and administration permission. The hook accepting the request is not proof of deployment; verify the live application. Validate the opt-in repository's current live snapshot before its first managed update, then confirm the bot's application comment and effective protection before merging the pilot.
