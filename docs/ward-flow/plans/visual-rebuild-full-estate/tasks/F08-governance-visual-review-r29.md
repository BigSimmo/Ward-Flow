# F08 Governance visual review r29

Date: 2026-09-13  
Scope: read-only inspection of the 17 supplied Governance captures at original detail.

## Findings

- **P1 — The selected override row is effectively unreadable in Light mode.** In `governance-populated-app-820-light-r29.png` and `governance-populated-app-1440-light-r29.png`, the WF-001 row paints a charcoal background while its identifier, time, coordinator, reason, and destination remain dark, very low-contrast text. The same dark surface begins in the 390 Light capture. Dark mode is coherent, and the Light drawing uses a light record card. The smallest fix is to resolve the selected-row surface and all of its text roles from the active theme within the Governance scope; do not alter selection or record content.
- **P1 — The detail notice makes an unsupported gate-failure claim.** Every supplied detail capture says, “The model records that a failing gate was overridden, but it does not record which gate failed.” The reviewed WF-001 record does not retain a prior gate verdict, and the engine permits an override for an otherwise eligible destination. The newly corrected register wording, “Referred by override,” is truthful, but the detail notice still converts absence of a gate verdict into a claim that a gate failed. Use wording that states only the recorded facts: the referral was made by override and no prior gate verdict or failed-gate identity is available.

No other P1 or P2 visual defect was found in the supplied regions. At 390, 820, and 1440 the populated register, tabs, selected detail, limitation notices, and explanatory cards remain contained and readable apart from the selected-row Light-mode defect. The Access record at 390 is clearly structured and does not imply a network-wide audit log. Differences from the drawing's invented counts, review decisions, and record population were treated as engine-authoritative rather than visual defects.

## Evidence and limits

Viewed originals:

- `governance-populated-{app,mock}-{390,820,1440}-{light,dark}-r29.png` (12)
- `governance-detail-app-{390,820}-{light,dark}-r29.png` (4)
- `governance-access-app-390-light-r29.png` (1)

The captures establish the visible populated, selected-detail, and phone Access-record states only. They do not prove keyboard/focus behavior, callbacks, print, forced colors, scroll ends, every lower explanatory card at 390, or broader completion. Command-side SCGH selection and override submission behavior were supplied as controller evidence and were not independently exercised in this read-only review.

## Additional source contradiction

`src/components/ward-management/ward-management-modes.tsx:473-476` says every legal deadline was removed from the model and therefore a third effectiveness measure cannot be computed. That is stale: `alerts/alerts-screen.tsx:106-156` derives the current deadline-bearing population from `movement.legalForm?.dueAt`, and the supplied runtime evidence reports four movements carrying a deadline with none overdue. The Governance test at `tests/ward-governance.dom.test.tsx:237-244` currently reinforces the stale “cannot be computed” claim.

Smallest truthful copy is a neutral metric absence: the proposed legal-deadline effectiveness measure is not published on Governance; legal deadlines remain recorded and monitored operationally. Do not claim the underlying deadlines were removed or uncomputable, and do not invent a new effectiveness definition, denominator, or target. The existing test should protect non-publication plus this retained-data distinction rather than requiring “cannot be computed.”
