# Core audit fixes — 7 October 2026

Task: repair the twelve findings in the local codebase behaviour audit. User authorised local patches and a read-only fetch of `BigSimmo/Ward-Flow` main. Base `9778c48`; branch `ward/audit-core-fixes`; isolated worktree `/workspace/Ward-Flow-fixes`. Synthetic fixtures only. No publication or deployment.

## State and persistence

Repatriation records the sending admission separately from the destination hold. The sending ward remains occupied through allocation and loses its occupant only when receiving arrival is recorded. Bed release refuses to refund/delete an occupied or foreign linked stay. Ordinary placement and arrival reject a second conflicting live stay for the same patient.

Gender correction updates the held admission and arrival records the gender used for occupancy counting. Incoming transfer details remain on the historical sending stay; the receiving stay starts a fresh transfer workflow. Patient identity routes prefer the current admission and its movement over historical records.

Transport schemas are validated in their owning contexts: movement transport and admission care transport are different records. Restored broadcasts require the collection, sequence, valid row fields and acknowledgement arrays before readers can touch them.

Evidence: nine new public-seam regressions failed before these changes; the regressions and existing care-journey suite pass together (70 tests). Source TypeScript check passed. Further compatibility and UI fixes in progress.

## Remaining patch groups

Draft persistence, expected departure editing, Settings operational defaults, board-refresh disclosure and accessibility preference wiring. Final checks and evidence will be appended here.
