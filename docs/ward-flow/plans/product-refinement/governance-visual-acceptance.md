# Governance — Q004 visual acceptance

Reviewed 2026-09-13 under the active lean visual policy. **Governance is recommended for scoped canonical Q004 acceptance.** No numerical score is assigned. Evidence is under `.superpowers/sdd/2026-09-13-product-refinement/screens/`.

| State                          | Actual inspected evidence                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Served drawing                 | `governance-reference-light-1440.png`; `q004-review-governance-reference-dark-1440.png`                  |
| Empty captured session         | `q004-review-governance-empty-dark-1440.png`                                                             |
| Real captured event and review | `q004-review-governance-reviewed-{light,dark}-1440.png`; `q004-review-governance-reviewed-light-820.png` |
| Phone history and disclosure   | `q004-review-governance-history-light-390.png`; `q004-review-governance-boundary-light-390.png`          |

The reviewed state came from a real local session: opening an existing discharge admission record produced one `Open discharge record` audit event, and marking that selected event reviewed produced a second `Review event`. The selected original event showed its actual record, time, role, destination link and recorded facts; Review and history then showed one recorded review with the captured time and role. No audit row, reviewer or historical record was seeded for the capture.

The 1440 light/dark pair keeps the drawing's register, selected-event detail and review/history hierarchy while replacing its fictional history with captured-session evidence. The dark empty state makes the absence of captured events explicit. At 820 the register, detail and review areas remain readable in a compact vertical flow. The two 390 captures show the selected event's complete immutable facts, the recorded review, both administrative review actions and the expanded synthetic/not-a-medical-device boundary without horizontal clipping or overlap. Review controls remain outside the internally scrolling history body and are reachable in the responsive document flow.

The actual DOM state for the generated `Review event` identified it as not reviewable and disabled both review actions. Source inspection also confirmed explicit selection, category/outcome/review filters, keyboard row and tab handling, guarded event/history reads, reset remounting, and separate legacy/effectiveness tabs. The focused Governance behavior gate passed 7/7 in `ward-tests-VPf1Xc` (`tests/ward-governance.dom.test.tsx`). No test was rerun for this evidence review.

No material contrast, clipping, hierarchy or interaction defect was found in the captured scope. The current screen deliberately departs from the drawing's invented reviewer and rows; this is the commissioned behavior, because it preserves the drawing's useful structure with real captured events and confirmations.

The evidence does not exhaust every event category or filter result in a physical UI journey. Reset, follow-up review, keyboard operation, long-history growth, print, hosted behavior and physical-device behavior were not visually exercised here. Review-of-review was verified from the actual DOM rather than a saved image. Those limits do not block scoped local acceptance because the commissioned real capture/review path, empty state, boundary, both desktop themes and representative tablet/phone layouts were observed, with the focused domain evidence reused.

D14 remains outside this acceptance. The current shortlist patient-ID reads drive Command identity and navigation; removing them changes behavior, while adding them to the patient-link allowlist would broaden the existing movement-drawer ruling. No default-deny guard change is justified without a separate owner decision and bounded contract work.
