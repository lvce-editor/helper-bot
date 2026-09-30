# Lvce Editor Helper Bot

GitHub Bot to automaticlly update lvce editor extensions to latest versions.

## Locking old issues and pull requests

The optional issue-locking worker is configured in `packages/app/dependencies.json` under `issueLocking`. It is disabled by default. To enable it, set `enabled` to `true` and list the exact `owner/repository` names to process. The GitHub App installation must have the `issues: write` permission; pull request locking also uses the Issues API.

`olderThanDays` defaults to 45. Issues are eligible from their `closed_at` date; pull requests must be merged and are eligible from `merged_at`. Closed, unmerged pull requests are left open to further conversation. The default run is daily at 07:00 in `Europe/Berlin`, including daylight-saving changes.

Each run scans at most five pages of 100 closed items per configured repository and locks at most 100 items across all configured repositories. Writes are serial and spaced by at least one second. A GitHub rate-limit or permission response stops work for that repository; the next scheduled run retries. The run rechecks each item before locking, so reopened or already-locked items are skipped.

Optional settings are `schedule.hour`, `schedule.minute`, `schedule.timeZone`, `maxPagesPerRun` (1–10), `maxItemsPerRun` (1–100), and `writeIntervalMs` (1–60000). Invalid configuration prevents app startup instead of silently broadening scope. Update and verify the GitHub App installation permissions before enabling this feature in production.
