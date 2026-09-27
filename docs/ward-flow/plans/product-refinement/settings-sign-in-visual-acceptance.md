# Settings and Sign in — Q004 visual review

Reviewed 2026-09-13 under the active lean visual policy. No numerical score is assigned. Evidence is under `.superpowers/sdd/2026-09-13-product-refinement/screens/`.

| Route    | Actual inspected evidence                                                                                                                                                                                                         | Served reference                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Settings | `q004-review-settings-top-{light,dark}-1440.png`; `q004-review-settings-{light,dark}-1440.png`; `q004-review-settings-light-820.png`; `q004-review-settings-light-390.png`                                                        | `settings-task11-reference-light-1440.png`; `q004-reference-settings-dark-1440.png` |
| Sign in  | `q004-review-sign-in-{light,dark}-1440.png`; `q004-review-sign-in-dark-820.png`; `q004-review-sign-in-{light,dark}-390.png`; `q004-review-sign-in-action-light-390.png`; `q004-review-sign-in-feedback-fixed-dark-{1440,390}.png` | `sign-in-task11-reference-light-1440.png`; `q004-reference-sign-in-dark-1440.png`   |

The review also inspected the four implementation files: `settings-screen.tsx`, `settings.module.css`, `ward-flow-sign-in-screen.tsx` and `ward-flow-sign-in-screen.module.css`.

Settings preserves the shared appearance and rail preference stores and their canonical writers. Default service remains an explicit unsaved readout; handover output, thresholds and demonstration controls remain read-only or linked to their real owners. The 1440 light/dark views and the 820/390 responsive views showed readable controls, clear selected states and no material clipping or overlap. The threshold table retains its full current columns in a named, focusable scrolling region.

The supplied 1440 dark reference was compared directly with the accepted dark live states. The current category rail and two-column cards retain the reference hierarchy while making the six settings easier to scan; the scrolled state keeps the threshold body bounded and leaves Demonstration data reachable below it. No material contrast, clipping or content-access defect was found.

The three category anchors cover the six current panels without adding a redundant settings filter. This is a proportionate deviation from the plan's PsychSift searchable-category reference: Ward's inventory remains fully visible and navigable, and the global Ward search is not presented as a settings filter.

Sign in preserves all seven roles, the thirteen-action partition and the universal refusals. The selected role changes local preview state only. The primary action remains deliberately inert: it creates no account or session, does not navigate, and performs no hosted authentication or permission change. Light/dark desktop, dark 820 and light/dark 390 captures showed no material responsive or contrast defect.

The supplied 1440 dark reference was also compared directly with the corrected live dark state. The current split role-and-capability layout retains the complete role inventory and reconciled action counts in a much shorter scan; bounded capability content remains reachable and the selected-role action/status panel stays visible without overlap.

The initial 390 action capture reproduced one presentation defect: the existing live-region message confirmed what would open and that nothing opened, but remained screen-reader-only. The same single `role="status"` node now becomes visible beside the selected-role action when populated; the announcement text and inert behavior are unchanged. Independent review of the corrected 1440 and 390 dark captures confirmed that the full status is clear, contained by the action panel and does not create clipping or excessive empty space. Before copies are under `.superpowers/sdd/2026-09-13-product-refinement/task11-review-fixes-before/`.

The worker's prior 24 focused tests are reused because the correction changes only presentation of the existing status node; no test was rerun for this review. These local screenshots do not establish real authentication, hosted behavior, print output or physical-device behavior.
