# F02/F13a + F01a adversarial review r1

Scope: source-only review of the latest Ward/Ward Answer and TrafficDiagram changes against the named snapshots. No tests, browser, server, provider, or source edits.

## Verdict

No concrete retained-behavior defect found.

## Ward and Ward Answer

- The shared WardScreen keeps presentation selection explicit. The Answer route uses the existing incoming array, displays a single non-empty request when one exists, and renders the explicit no-referral absence sentence when it is empty. Previous/Next state clamps to the remaining incoming array after mutation.
- Overview JSX still mounts the engine-backed entry, bed, daily-return, coming-in, awaiting-answer, leave-bed, and action sections. The overview CSS order changes reading layout only; the sections and handlers remain present. Answer mode intentionally hides overview-only panels via the explicit presentation selector and leaves only Answer navigation, disclosure, and Awaiting your answer visible.
- Accept, decline, override/rejection, pull/release, preparation, capacity, leave-bed, and refusal explanations remain in the source. No fake “Worth your attention” or “Going out” count was introduced; attention values are derived from pending preparation, blocked-today breakdown, and refresh request state.
- The route keeps ward-scoped referral visibility and existing FD-22/FD-23 privacy boundaries. No other-destination list or parallel-referral count is rendered. Existing answer links and board/daily-return links remain reachable from the overview.
- The new nested `dl` fact groups use `div` wrappers containing only `dt`/`dd`, and no invalid extra paragraph was found in the Ward files. The earlier Statistics landing `dl` issue is outside this batch and is recorded as fixed by the parent.

## Movements TrafficDiagram

- `movements-screen.tsx` still computes `corridors` from `corridorCounts(movements)` and applies the established count-then-origin deterministic sort before passing them to `TrafficDiagram`.
- `traffic-diagram.tsx` renders the same corridor list in both the SVG paths and ranked rail; no new sorting or filtering is applied there. Refused/unaccepted corridors remain excluded with the existing truthful absence explanation. Unknown ED/unit ids retain explicit record-level fallback wording.
- The new diagram has an explicit keyboard-focusable region and SVG accessible name. Its endpoint-label sorting affects only endpoint row placement, not corridor ranking or data membership.

## Snapshot/evidence limits

`before-F02-visual-r7` contains only the Ward screen TSX/CSS, so it cannot independently prove the newly added Answer route or all route-level source files. `before-F01a` contains the pre-diagram Movements screen/CSS and therefore has no prior TrafficDiagram component to compare byte-for-byte. This is source evidence only; rendered order, phone overflow, focus, and dark-theme appearance remain runtime questions.
