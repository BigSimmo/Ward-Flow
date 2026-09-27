# Fix plan — tests, verification, statistics and the fold gate (WF-34/35/47/52) — read-only Opus planner, 16 Sept 2026, base 65aa7c54a6

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/HOW-WE-WORK.md`.** Kept for history; do not follow. Its mutation-proof requirement is replaced by the 17 Sept test-scope rule.

## Key findings

- WF-35: `screen-verification.mjs:141-147` marks a screen CURRENT purely because its drawing hash matches;
  source never compared. Pre-commit trigger (`.githooks/pre-commit:59`) ignores `mockups/MANIFEST.json`.
- WF-47: the n=1 median is **already suppressed** (floor 5, tested) — ledger §7.3 row is stale. Real
  latent defect: the community comparison table renders bare `lists.*.length` without the membership gate
  (statistics-community-screen.tsx:145-148, 376-378).
- WF-34: `run-ward-tests.mjs` does not report skipped or wholly-skipped files; patient-link detector misses
  destructuring. "retry vs reset" is not a defect (Next 16 uses `retry`).
- Legal-figure guard: one `it` with 90s timeout, nested loops over codes × event types.
- Two `expect(true)` tests (ward-screen-overview-and-entry.dom.test.tsx:110-112, 169-171); stale comment.
- 12 retired `describe.skip` suites all recorded and imported modules declared unreachable, but nothing
  ties the three facts mechanically; pointer-integrity floor is 1 while 2 markers exist.
- Ledger write discipline will report 28 × "introduced without moving the identical pending request"
  (base `ef582b110f`); the move executed Ruling 14 (says 27, moved 28).
- Orphaned worktree registration `ward-lead1` → missing `C:/Users/joshs/.codex/worktrees/39cd/ward-lead`,
  detached at `4c02ac28cb` (reachable elsewhere, nothing unique lost).

## Tasks (Sonnet, one worktree each, mutation proofs via `node scripts/ward-flow/mutation-run.mjs`)

T1 move the 28 migrated inbox files into `docs/ward-flow/migrated-inbox-requests-2026-09-16/` (Q1=A) S ·
T2 turn the two tautology tests into real assertions + new `tests/ward-no-tautological-cases.test.ts`
guard (floor ≥200 files, sentinels) S · T3 split the legal-figure sweep into one `it` per form code (keep
every assertion; drop 90s only if each <15s) M, do last · T4 separate drawing state from implementation
state: library, "DRAWING UNCHANGED since look" (no CURRENT), implementation hash at look, `--report`,
`--hash`, pre-commit watches MANIFEST.json M · T5 guard tying retired suites to the retired-coverage
record and the reachability list; raise pointer floor to 2 S · T7 ward runner reports skipped/todo and
wholly skipped files S · T8 community comparison table uses gated figures (`data-unmeasured`) S · T9 after
fold: measure local server stability (34 routes × 3) into an evidence doc S · T10 detect destructured
`patientId` reads (may go red — hand back names; privacy) S · T11 remove orphaned worktree registration
(Q3; Verifier; backup, unlock, prune --dry-run then prune with CLAUDE_ALLOW_PROTECTED_DELETE=1) S · T12
delete zz-clock-probe (Q2; Verifier; record reduction in diff-integrity.json) S · T13 controller corrects
§7.3 rows WF-34/35/47/52 at fold S.

## Owner questions

Q1 the 28 migrated inbox files: A move to a Ward Flow archive folder [rec] / B accept a failing check / C
put back pending · Q2 delete zz-clock-probe [yes] · Q3 remove orphaned `ward-lead1` registration [yes] ·
Q4 keep WF-47 metric definitions "Later"; build only T8 now [yes].

## Fold gate (combined line → ward-lead). Each command `; echo "exit=$?"`, never piped into tail.

`TIP=$(git rev-parse HEAD)`; `WL` = ward-lead HEAD at fold time.

1. `bash ~/.claude/hooks/ward-fold-debt.sh --report`
2. `env -u MSYS2_ARG_CONV_EXCL bash ~/.claude/scripts/backup-work.sh`; confirm bundle heads match live refs.
3. `git status --porcelain | wc -l` = 0; `bash scripts/ward-flow/folded.sh . $TIP 65aa7c54a6 <task tips>` exit 0.
4. `--check` on screen-map, rules-index, owner-rulings-index, mockup-manifest, screen-verification.
5. `npm run check:ledger-write-discipline` prints "passed for <base>..<TIP>".
6. `node scripts/check-diff-integrity.mjs --self-test && node scripts/check-diff-integrity.mjs --base $WL`.
7. `npm run check:ward-source-control-chars`, `check:ward-text-size`, `check:ward-citations`,
   `check:ward-errata-freshness`.
8. `npm run docs:check-links`.
9. If drawings changed: `node scripts/ward-flow/check-drawing-rules.mjs $(git diff --name-only $WL $TIP -- 'docs/ward-flow/mockups/*.html')`.
10. If `src/app/mockups` changed: `node scripts/check-mockup-retirement.mjs --diff $WL`.
11. Lint changed files: `git diff --name-only --diff-filter=ACMR $WL $TIP -- '*.ts' '*.tsx' '*.mjs' '*.mts' | xargs node ./node_modules/eslint/bin/eslint.js --max-warnings 0` (record file count).
12. `npm run typecheck:internal -- --extendedDiagnostics` (fresh, record "Files:").
13. `npm run check:ward-expected-reds` → "OK — N files, M tests, 0 failing", N ≥ 200.
14. `npx vitest run tests/source-control-bytes.test.ts`.
15. `npx playwright test --project=chromium-mockups --list ui-ward-` then `npm run test:e2e:ward-journeys`
    (passed+skipped+failed = listed; failed 0); `npm run ensure` + `/api/local-project-id` first if needed.
16. `git rev-parse HEAD` = `$TIP`, clean tree.
17. In ward-lead: `git merge --ff-only $TIP`; fold-debt report says "current".
    Formatting omitted deliberately (never pushed; byte guards run in step 13). Run heavy steps once, with
    nothing else heavy on the machine; `typecheck`/`lint` npm scripts may return reused receipts.

## Risks

Shared files across planners (ledger §7.3, PROJECT-ISSUES, screen-verification json/page, legal-figure
guard, patient-link guard) — regenerate generated pages after merges; no heavy-run lock in the ward
runner scripts; T4 hashes a shared statistics folder so one edit marks 6 screens changed (intended); T3
must not reduce rounds; T10 may go red at birth; ward-lead moving during the gate fails the ff.
