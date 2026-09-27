---
name: narrowing-scope-falsifies-the-docs-that-travel
description: "Splitting a change into a smaller PR can make documentation that travels with it false, because prose written for the whole change describes siblings that no longer ship alongside it"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fa69685a-38db-4370-b1f2-c9129a7318f0
  modified: 2026-09-17T13:49:40.363Z
---

Deciding to ship a smaller slice of a branch does not just drop files — it can turn prose
that came along into a lie. Documentation written for the WHOLE change describes its siblings
in the present tense, and once they are split out that tense is wrong.

2026-09-17, assembling the catalogue-read migration as a 9-file PR out of a 69-file branch:
docs/site-content-sync-runbook.md (gone — that runbook was deleted) travelled with the migration and said "`npm run
check:read-path-cost` refuses ... automatically". That gate was deliberately left for a
follow-up PR, so on this branch the script did not exist. `npm run docs:check-scripts` caught
it — 1 stale reference out of 1,293 — and it was a real defect, not a gate being fussy: a
living runbook claiming a guard exists is exactly how the next reader stops looking.

**How to apply:** when you narrow a change, re-read every doc you are carrying and ask which
sentences were true only because of the files you just dropped. The failure is invisible in
the diff — the doc's own lines are unchanged and look reviewed. Only its RELATIONSHIP to the
tree changed.

Two asymmetries worth knowing here:

- `docs/audit/` and `docs/archive/` are excluded from `check-docs-script-refs` as dated
  point-in-time records (`HISTORICAL_DIRS` in `scripts/check-docs-script-refs.mjs`), so an
  audit note naming a not-yet-shipped script passes while a runbook naming it fails. Correct,
  but it means the gate covers only half of what you carried — check the excluded docs by eye.
- The honest fix is usually to REMOVE the claim, not soften it. Prose describing a guard
  belongs in the change that ships the guard.

Related: [[a-declaration-is-not-an-effect]], [[a-comment-that-predicts-an-edit-elsewhere]],
[[no-longer-compresses-to-never]], [[prose-belonging-to-the-record-next-door]].
