# Capacity — Q004 visual acceptance

2026-09-13, local branch `codex/task-ward-flow-live-state-20260831`. Controller Astra inspected the served reference and running route; independent Sol reviewed the corrected evidence. **Visual acceptance with documented deviations**, not whole-task completion or hosted readiness.

Evidence directory: `.superpowers/sdd/2026-09-13-product-refinement/screens/`. Existing unaffected observations were reused; changed states were recaptured.

| View       | Live evidence                                                                                                       | Served reference evidence                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 390 light  | `capacity-accept-light-390.png`, `capacity-linked-light-390-accept.png`                                             | `capacity-reference-accept-light-390.png`                                                   |
| 390 dark   | `capacity-final-dark-390.png`, `capacity-map-dark-390.png`, `capacity-ward-dark-390-confirmed.png`                  | `capacity-reference-map-dark-390-viewport.png`                                              |
| 820 light  | `capacity-accept-light-820.png`, `capacity-linked-light-820-accept.png`                                             | `capacity-reference-accept-light-820.png`                                                   |
| 820 dark   | `capacity-accept-dark-820.png`                                                                                      | `capacity-reference-accept-dark-820.png`                                                    |
| 1440 light | `capacity-final-light-1440.png`, `capacity-table-corrected-light-1440.png`, `capacity-linked-detail-light-1440.png` | `capacity-reference-final-light-1440.png`, `capacity-reference-table-light-1440-accept.png` |
| 1440 dark  | `capacity-accept-dark-1440.png`, `capacity-table-corrected-dark-1440-accept.png`                                    | `capacity-reference-accept-dark-1440.png`, `capacity-reference-table-dark-1440.png`         |

Independent affected-state score: fidelity 1.5, spacing 2, readability 2, controls 2, responsive 1.5 = **9/10**. The taller small-screen shell contains actual role/navigation controls. No material visual defect was found in the final packet; the controller subsequently checked the corrected dark table and dark tablet comparison. This is a subjective review summary, not an objective quality measurement.

Map selection and ward/discharge tabs reach actual guarded example records. Phone detail remains readable with reachable footer actions. Returning from the network freeing selection restores focus to its opener. Desktop map/sidebar and table retain bounded independently scrolling bodies; phones release these bounds. Numeric table alignment and wrapping were corrected after direct comparison, and dark metric hover stripes were corrected at their inherited CSS source.

Deviations are detailed in `task-4a-report.md`: actual statewide populations and 15 operational columns remain; network summaries are tabbed; patient detail uses the approved guarded discharge projection rather than copied fictional identities; missingness/preparation semantics remain; explanatory product prose is removed. Wider operational tables retain horizontal scrolling instead of dropping facts.

Checks reused: Capacity 25/25 (1 file handed in / 1 ran, `ward-tests-lukpKJ`); five new guarded discharge UI journeys and bed-map checks passed in `ward-tests-lfCazT`; source typecheck passed after explicit new-command classifications. The cumulative Ward domain gate is reserved for final integration; known pre-existing D14 guard findings remain separately tracked.

Print limitation: computed ward-label visibility and table wrapping were checked under print media, but actual printed output is **unverified**. The in-app browser reports printing unavailable; print-emulation screenshots produced unreliable blank/repeated regions despite visible computed text. `capacity-print-final-1440-accept.png` and `capacity-print-native-1440-accept.png` are diagnostic failures, not acceptance evidence. No PDF was produced. This limitation does not invalidate the six screen-mode comparisons above.
