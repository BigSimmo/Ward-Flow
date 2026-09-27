---
name: release-governance-owner-decisions-2026-09-16
description: "Josh's 2026-09-16 rulings on merge authority, clinical classifier, review records, live-settings access, deploy lock and squash merges for the Database repo (origin/main release process)"
metadata:
  node_type: memory
  type: project
  originSessionId: 43862651-3477-40fc-9e10-33df5c9a09e6
  modified: 2026-09-16T21:19:41.835Z
---

Owner rulings, 2026-09-16, in the release-process audit chat (plan: `~/.claude/plans/ok-please-can-you-nested-music.md`). These are about **origin/main (the live site)**, not the Ward Flow line.

1. **Merge authority:** agents MAY arm auto-merge on green PRs, EXCEPT clinical-content (clinicalRisk), any `supabase/**` database change, RAG-ranking surfaces, and the classifier manifest — those Josh merges by hand. Merge method for agent-armed auto-merge: **squash**.
2. **Clinical classifier:** narrow `scripts/pr-policy.mjs` broad `src/lib` regex (258/503 files) to a named list; Josh signs the list off before it takes effect.
3. **Review records:** move out of commits (PR comments with a machine-readable marker), not `docs/branch-review-records/*.record.md`.
4. **Live settings:** agents may READ GitHub/Railway settings freely; must ASK before changing anything live; never print secret values.
5. **Deploy lock:** add a migration-before-deploy pre-deploy gate, report-only first, enforce after 3 clean deploys per service; Josh merges both.

Same day, Josh chose to disable auto-merge on #2816, #2814, #2809 (clinical, armed by the BigSimmo identity, probably cloud `claude/*` sessions). #2808 had already merged at 11:51Z (sha 1b1b0f6796) without owner review. #2814 edits three already-applied migrations (20260824122000, 20260824123000, 20260830121000) — those edits never reach the live DB.

**Why:** prose rules did not stop agents arming auto-merge on clinical and migration PRs; the guard in `guard-push.mjs` only checks at push time. Disarming and even converting to draft did NOT hold: cloud `claude/*` sessions re-armed within 21–85 s, and one merged directly without auto-merge (#2826).

**Outcome, 2026-09-16 evening:**

- **#2828** repaired the repo side. Live was correct; the three edited migrations were restored to their as-applied bytes, and the CI-regenerated manifest replaced a hand-edited one. `Live drift` went green on a0c9339d3.
- **#2830** made `PR policy` (a required check) default-red on owner-merge PRs until `owner-approved` is present. The label counts only if the owner account applied it, not through an App, and after the head was first seen. #2830 also blocks edits to applied migrations and out-of-order or future-dated migrations. Proven live: #2827 went red with "Owner merge required (clinical)".
- Repo auto-merge was re-enabled after that proof. "Actions can approve PRs" was turned off.

**How to apply:**

- **Never add `owner-approved` yourself,** even with a blanket go-ahead from Josh; it is his control.
- **An open PR keeps its old `PR policy` result** until some event re-runs it. A re-run replays the old workflow revision, so trigger a new event instead (e.g. add the `hold` label).
- **CI drift-manifest freshness compared only `schema_sha256`** until #2833, so hand-edited manifests passed.
- **`live-drift` on push sampled live mid-apply** (false findings) until #2833.

Related: [[checks-that-cannot-fail]], [[protected-work-and-backups]].
