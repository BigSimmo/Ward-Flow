---
name: automations-switched-off-2026-09-17
description: 'Josh approved switching off noisy GitHub automations on BigSimmo/Database on 2026-09-17 (reversible); do not re-enable them as a "fix"; a clean-up PR series deletes them'
metadata:
  node_type: memory
  type: project
  originSessionId: 43862651-3477-40fc-9e10-33df5c9a09e6
  modified: 2026-09-17T05:06:54.919Z
---

On 2026-09-17 ~05:00Z, with Josh's explicit approval, these were switched off on BigSimmo/Database. Nothing was deleted; each is reversible.

- **Repo variables:** `PR_BATCH_ENABLED` true → **false**; `CI_TRIAGE_ENABLED` true → **false**.
- **Workflows disabled** with `gh workflow disable`, all previously `active`:
  - `pr-batch-runner.yml`
  - `pr-batch-review-wake.yml`
  - `codex-autofix-review-comments.yml`
  - `codex-run-pr-operator.yml`
  - `notify-ci-failure.yml`
  - `ci-triage.yml`
  - `claude-backlink.yml`
  - `docling-lab.yml`
  - `summary.yml` (id 300609299)
- To undo one: `gh workflow enable <file> --repo BigSimmo/Database` or `gh variable set <NAME> --body true`.

**Why:** an Opus governance-cuts assessment on 2026-09-17 found:

- the batch runner woke after every workflow (300 runs in 6.5 h, 122 cancelled);
- the Codex autofix pushed onto Claude's branches;
- the Codex run-pr operator failed 15 of 20 runs;
- `notify-ci-failure` had no Slack/Discord secret (99 of 100 skipped);
- `summary` failed 24 of 27 and `docling-lab` was unused.

The full report is in the Governance Audit session scratchpad (`governance-cuts.md`).

**Also approved the same day:**

- Clean-up PRs that delete these automations, cut AGENTS.md to about 1,500 words (history archived), remove prose-pinning tests, remove the gate arbiter, move review and inbox records out of commits, and add a "sync main only on a real conflict" rule.
- `ops-digest` from hourly to daily.
- Josh to uninstall CodeRabbit and turn off Cursor Bugbot.
- Railway watch negations for the two metadata snapshots.

**How to apply:** if a PR or CI step seems to "need" one of these, do not re-enable it; check with Josh. Related: [[release-governance-owner-decisions-2026-09-16]].
