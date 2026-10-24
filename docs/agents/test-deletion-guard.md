# Deleting tests, or letting a tool delete them for you

> **Ward Flow scope note (3 October 2026):** `npm run check:diff-integrity` runs in `BigSimmo/Ward-Flow` (via `scripts/ward-ci-public/changed-checks.mjs` in the `Ward Flow static checks` CI job and local readiness gates). Per Prototype Operating Mode §3 in [`AGENTS.md`](../../AGENTS.md), test-count floor drops are advisory by default (`DIFF_INTEGRITY_STRICT=1` restores the hard floor), while truncation artefacts and an unreadable before-state always fail. References below to `tests/ui-smoke.spec.ts`, `tests/ui-tools.spec.ts`, `static-pr`, and `tests/playwright-pr-shards.test.ts` are historical PsychSift provenance.

On 2026-08-31 a commit on PR #2481 titled "test(ui): compare answer status surfaces" changed
one file with 4 insertions and 4,924 deletions: `tests/ui-smoke.spec.ts` fell from 6,001
lines / 89 test cases to 1,081 / 9. The four "insertions" were not code — they were a
file-reading tool's own truncation banner written back as file content, one line carrying a
literal `N tokens truncated` marker inside what should have been TypeScript. A tool had
regenerated the whole file from a truncated read instead of editing a region of it. Squash
auto-merge was armed; only an unrelated merge conflict stopped it, and the branch's later
merge of `main` silently restored the file, so the squash landed clean. Nothing was lost, by
luck rather than by any gate (`#Y30AXB`).

`npm run check:diff-integrity` is that gate. Since 3 October 2026 (owner-approved prototype mode) a
measured test-count reduction is advisory unless `DIFF_INTEGRITY_STRICT=1`; truncation artefacts and
an unreadable before-state still fail. It runs unconditionally in `verify:cheap` and
`verify:pr-local`, and in Ward Flow CI's `Ward Flow static checks` job (`scripts/ward-ci-public/changed-checks.mjs`; formerly PsychSift's `static-pr` job), comparing against the merge base with
`origin/main` — never the previous commit, so removing tests across several small commits is
still measured as the whole drop. Two rules:

- **Test-case floor.** Test cases are counted from the TypeScript AST, not by grepping for
  `test(`: a grep counts `/re/.test(x)` and, far worse, keeps counting a block of tests after
  someone comments it out. Measured both in aggregate (all changed test files together, 25%)
  and per surviving file (50%, above a 3-case floor so tiny edits stay quiet). The aggregate
  alone would flag the ordinary refactor that deletes one spec and adds its replacement; the
  per-file rule alone would miss a suite gutted inside a large PR whose other additions absorb
  the loss. Calibrated against 300 real commits touching `tests/`: zero flagged, while the
  #Y30AXB commit fails both.
- **Truncation artefact.** No added line, in any file, may carry a tool's truncation banner.
  This is the actual signature, and unlike the first rule it also covers the same tool failure
  landing in `src/`.

A second known limitation: the gate measures the diff a **pull request** presents, never a
merge commit's own resolution. On 2026-08-17 merge commit `ab7c5134f` (PR #2025) resolved a
conflict in `tests/ui-tools.spec.ts` by dropping the 320 px low-confidence `AccessibleTable`
journey that PR #2006 had added the day before; no non-merge commit ever removed it, so no PR
diff ever showed the loss, and it went unnoticed until the 2026-09-02 audit (M31). A journey
that must survive is therefore pinned **by name** as well (in PsychSift, `tests/playwright-pr-shards.test.ts`). In Ward Flow only the release-gate journeys are pinned: `npm run test:e2e:release-gate` passes `--require-release-gate`, and `scripts/run-playwright.mjs` fails unless every journey listed in `scripts/ward-flow/browser-run-contract.mjs` ran on both release-gate projects. Nothing pins the other `tests/ui-ward-*.spec.ts` journeys; `scripts/ward-flow/journey-durations.json` is only a shard-balancing timing hint, and a missing spec there fails nothing. A spec no matcher names is a
spec that can vanish without anything failing. Prefer a dedicated spec file over a case
appended to a large shared spec when a conflict there is likely.

Known limitation, deliberately accepted: a `test()` inside a `for (const viewport of …)` loop
counts once, not once per iteration, so shrinking that loop's array loses real cases without
moving the count. Any static count has this hole; the aggregate and the truncation rule are
unaffected, and closing it would mean evaluating the spec rather than parsing it.

A deliberate reduction is a **reviewed** change, not a silent one: add the exact
`{path, before, after, reason, approvedOn}` to `diff-integrity.json`. An approval pins both
counts, so it cannot quietly cover a later, larger cut. Do not raise the thresholds to clear a
diff — that is the move this gate exists to prevent. The gate fails closed: an unresolvable
base or an unreadable blob is a failure, never a pass.
