# F14 Hub palette guard — r37

## Trigger

The 454-file integrated suite completed with 5,077 passing tests and one failure in `tests/ward-hub-bar-colours.test.ts`. The test's final resolver-floor assertion required the historical `--ward-border-strong` chain to end in a hex literal. The current third-edition carrier correctly aliases that role to `--line-strong`, whose canonical light and dark values are `rgba(...)`; the product paint was valid and the test's literal-shape assumption was stale.

## Correction

- The resolver now reads `src/app/ward-flow-shell-tokens.module.css` before the legacy Ward and global token layers, matching the Hub screen's local `wardShellTokens` composition.
- The guard pins the exact alias `--ward-border-strong: var(--line-strong)`, requires both palette resolutions to equal the canonical `--line-strong` resolution, and requires a concrete rgba literal.
- The original pairwise comparison of Ready, Not yet cleared, and Out of service segment paints is unchanged. It remains the behavioral guard against two adjacent quantities collapsing into one visible segment.
- Five and only five Hub paint dependencies are scope-checked: `--good`, `--warn`, `--danger`, `--surface`, and `--line-strong`. Balanced extraction names the base, prefers-dark, explicit-dark, forced-colors, and print CSS blocks. The assertions require one base and prefers-dark value, an identical explicit-dark value, a restored base value in print, the expected forced-colors shape, and an exact reconstruction of each token's full declaration array. This makes the resolver's light/dark indices proved source structure rather than an unguarded position assumption.

## Parser correction

The first scope-check implementation passed the marker `.wardShellTokens {` to a helper that searched for an opening brace only after the complete marker. It therefore skipped the base rule's own brace and captured a later nested body; the focused run correctly exposed this as print expected light / actual base dark. The helper now searches from the marker start. Markers that include `{` use that brace, while markers naming an at-rule or selector still use the next brace. No assertion was removed or loosened.

## Evidence and status

- Current `tests/ward-hub-bar-colours.test.ts` SHA-256: `2CE56A5C99C8EE2D343B5D8FF7C43A6D5A0B1E5C2F9335AA1059749810637A65`.
- `git diff --check -- tests/ward-hub-bar-colours.test.ts` passed after the parser correction.
- The pre-parser-fix focused session `N0seHa` ran three files / 51 tests: 49 passed and two failed. The Hub failure was the parser defect above; the other failure was the independently owned Movements duplicate `Arrived` query.
- The controller then ran `node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-movements-screen.dom.test.tsx tests/ward-hub-bar-colours.test.ts` in focused session `80551` (`cKs8Ph`): two files handed in and run, 35 tests collected, 35 passed and zero failed. This proves the corrected Hub guard and the co-run Movements file at the current focused source state; no broad suite was rerun after the correction.

## Verification-record boundary

This correction is a test guard for a previously inspected Hub visual property. It does not add a new six-cell screen review and cannot establish the 34-item screen definition of done. If the controller records it in `docs/ward-flow/screen-verification.json`, the existing `/hub` object should remain `verdict: "deviates"`; append a narrow note naming this report, the focused result, and the preserved three-segment collision guard. Do not change `date`, `who`, `widths`, `themes`, or `mockupSha256` without new corresponding visual evidence. Regenerate `docs/ward-flow/SCREEN-VERIFICATION.md` with `node scripts/ward-flow/screen-verification.mjs`, then use `--check` for structural/current generated-record proof. The schema supports only `matches`, `deviates`, or `blocked`; it has no full-DOD verdict, so limitations must stay explicit in `notes`.
