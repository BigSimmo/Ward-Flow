# F13/F00 final adversarial source review r23

Date: 2026-09-13
Scope: bounded source review of the additive Ward Answer facts/gates, the Tasks row navigation close fix, and `tests/ward-answer-current-facts.dom.test.tsx`. Compared against the recorded Ward Answer before snapshot and the Tasks before hashes in `F02-ward-answer-populated-correction-r19.md` and `tasks-open-movement-r1.md`.

## Findings

- **P1 — FD23 privacy regression detected by focused evidence.** The current focused run covered 4 files / 46 tests: 45 passed and 1 failed. The failing FD23 case is `WF-013` (`BTY Older Adult` / `SJGM Emergency Department`), where the newly added current-facts/gates markup is exposed on a non-Answer Ward screen. This is a real source regression, not a stale assertion; the source must keep the expanded facts/gates presentation behind the Answer presentation guard.
- **P1 — additive facts/gates are currently unconditional.** The Ward Answer facts/gates block at the source's current lines 1715–1850 is rendered for normal Ward Screen presentation as well as Answer, contrary to the Answer-only brief. Sol's source correction is in progress; closure is pending a source read-through and rerun.
- **Closed after correction:** the current source now guards the rich facts/gates fragment with `presentation === "answer"`, restores the normal Ward compact metadata row, and uses the neutral `Emergency department. Origin department is not disclosed in this ward view.` wording on Answer. The focused correction run covered 2 files / 6 tests and reported 6/6 passed (controller evidence: `ward-tests-KL7fA4/report-0.json`).
- Ward Answer derives its eight displayed facts from the movement and origin ED, calls the existing `eligibility(movement, unit, now)` result, preserves gate order/detail text, and explicitly states missing patient name/age. The added test checks that linked referral-only fields do not appear, that the failed capacity gate remains informational, and that all returned gates render.
- The Answer action callbacks remain the existing Accept/Decline paths. The new decline test proves an explicit existing reason is required and records `no_bed`; it does not bypass the reducer or invent a new reason.
- The Tasks regression is meaningful: it mounts the real `WardFlowProvider` fixture, opens the actual Tasks drawer, clicks `ward-task-bed-pull-WF-004`, asserts the exact movement URL passed to the router, and asserts the Tasks sheet is removed. `setOpenPanel(null)` occurs before `router.push`, preserving the intended close-before-navigation ordering.
- FD22/FD23 safeguards remain visible in the Answer source: no parallel-destination count/list is rendered, no patient identity join is added, and current movement facts/gate details do not claim ranking, clinical capacity, or hidden referral destinations.

## Verification limits

The earlier 4-file run remains recorded accurately as 45/46 with one FD23 failure. The subsequent 2-file correction run is 6/6 passed and closes that specific regression. Browser, print, full-suite, and provider/live checks were not performed here.
